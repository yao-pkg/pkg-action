// Orchestrator — runs end-to-end inside the Node24 JS action invoked by the
// composite at the repo root.
//
// Pipeline:
//   parseInputs            → typed input record (+ secret registration, typo warnings)
//   readProjectInfo        → package.json name + version
//   resolveTargets         → 'host' → hostTarget() | explicit list
//   runPkg                 → @actions/exec → @yao-pkg/pkg CLI
//   mapPkgOutputs          → reconcile on-disk outputs to targets
//   per binary:
//     apply filename template → move into place
//     (optional) patch Windows PE resources
//     (optional) sign (macOS codesign / Windows signtool / Azure Trusted Signing)
//     archive (if compress != none)
//     compute checksums
//     record summary row
//   writeSummary           → GITHUB_STEP_SUMMARY
//   setOutputs             → binaries / artifacts / checksums / version
//
// The action stops at "build a signed, checksummed archive on disk". Workflow
// artifact upload, GitHub release attach, Docker/Homebrew/Scoop distribution,
// and SBOM/provenance are the caller's responsibility — chain dedicated
// actions (upload-artifact, softprops/action-gh-release, docker/build-push-
// action, etc.) against the paths emitted in the `binaries` / `artifacts` /
// `checksums` outputs.

import * as core from '@actions/core';
import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename as pathBasename, dirname, join, resolve as pathResolve } from 'node:path';
import {
  actionsLogger,
  applyWindowsMetadata,
  archive,
  computeAllChecksums,
  createInvocationTemp,
  formatErrorChain,
  formatTarget,
  hostTarget,
  mapPkgOutputs,
  parseInputs,
  parseSigningInputs,
  parseWindowsMetadataInputs,
  readProjectInfo,
  render,
  runPkg,
  signMacos,
  signWindowsSigntool,
  signWindowsTrustedSigning,
  tokensForTarget,
  writeShasumsFile,
  writeSidecar,
  writeSummary,
  closestInputName,
  VERSION,
  type ActionInputs,
  type ChecksumAlgorithm,
  type ExecFn,
  type Logger,
  type OutputEntry,
  type SigningInputs,
  type SummaryRow,
  type Target,
  type WindowsMetadataInputs,
} from '@pkg-action/core';

// ─── @actions/exec bridge ─────────────────────────────────────────────────

import { getExecOutput } from '@actions/exec';

const execBridge: ExecFn = async (command, args, options) => {
  // Build the opts object conditionally to satisfy exactOptionalPropertyTypes.
  const opts: {
    ignoreReturnCode?: boolean;
    cwd?: string;
    env?: Record<string, string>;
  } = {};
  if (options.ignoreReturnCode !== undefined) opts.ignoreReturnCode = options.ignoreReturnCode;
  if (options.cwd !== undefined) opts.cwd = options.cwd;
  if (options.env !== undefined) {
    // process.env values are `string | undefined`; filter the undefined ones.
    const merged: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) merged[k] = v;
    }
    for (const [k, v] of Object.entries(options.env)) merged[k] = v;
    opts.env = merged;
  }
  const result = await getExecOutput(command, [...args], opts);
  return {
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
  };
};

// ─── Orchestrator entry ───────────────────────────────────────────────────

async function main(): Promise<void> {
  const logger = actionsLogger;
  const overallStart = Date.now();
  logger.info(`pkg-action build v${VERSION} — orchestrator starting`);

  // 1. Parse inputs. Secrets are registered via core.setSecret BEFORE any
  //    validation error can reference user-supplied values in a log line.
  let inputs: ActionInputs;
  try {
    inputs = parseInputs({
      registerSecret: (v) => core.setSecret(v),
      onUnknownInput: (name) => {
        const hint = closestInputName(name);
        const suffix = hint !== null ? `. Did you mean "${hint}"?` : '';
        logger.warning(`Unknown input: "${name}"${suffix}`);
      },
    });
  } catch (err) {
    core.setFailed(formatErrorChain(err));
    return;
  }

  // 2. Project directory + metadata.
  //
  // When `config` points at a package.json, the project root is its parent
  // directory — pkg reads that package.json as the entry. When `config` is a
  // non-package.json (e.g. .pkgrc.json) or is unset, the project dir is
  // GITHUB_WORKSPACE (or cwd when running locally).
  const workspace = process.env['GITHUB_WORKSPACE'] ?? process.cwd();
  const projectDir = (() => {
    const cfg = inputs.build.config;
    if (cfg !== undefined) {
      const absCfg = pathResolve(workspace, cfg);
      if (pathBasename(absCfg).toLowerCase() === 'package.json') {
        return dirname(absCfg);
      }
    }
    return workspace;
  })();
  const project = await readProjectInfo(projectDir);
  logger.info(`[pkg-action] project dir: ${projectDir}`);
  logger.info(`[pkg-action] project: ${project.name}@${project.version}`);

  // 3. Resolve targets — 'host' → explicit host target.
  const resolvedTargets: Target[] =
    inputs.build.targets === 'host' ? [hostTarget()] : [...inputs.build.targets];
  logger.info(`[pkg-action] targets: ${resolvedTargets.map(formatTarget).join(', ')}`);

  // 4. Invocation-scoped temp dir + output dir.
  const runnerTemp = process.env['RUNNER_TEMP'] ?? tmpdir();
  const invocationDir = await createInvocationTemp(runnerTemp);
  core.saveState('invocationDir', invocationDir);
  const pkgOutputDir = join(invocationDir, 'pkg-out');
  await mkdir(pkgOutputDir, { recursive: true });

  // 4.5. Materialize `config-inline` to disk, if set. parseInputs already
  //      validated it as a JSON object and enforced mutual exclusion with
  //      `config`, so this step just writes the bytes and threads the resulting
  //      path through as the effective config.
  let effectiveConfig = inputs.build.config;
  if (inputs.build.configInline !== undefined) {
    const inlinePath = join(invocationDir, 'pkg-config.inline.json');
    await writeFile(inlinePath, inputs.build.configInline, 'utf8');
    effectiveConfig = inlinePath;
    logger.info(`[pkg-action] materialized config-inline → ${inlinePath}`);
  }

  // 5. Run pkg from the project directory.
  //
  // When a package.json was used to locate the project, drop the explicit
  // `--config` flag — pkg will pick up the local package.json via the
  // positional `.` argument. Otherwise keep `--config` (it points at a
  // standalone pkg config like .pkgrc.json).
  const pkgCommand = inputs.build.pkgPath ?? 'pkg';
  const cfgIsPackageJson =
    effectiveConfig !== undefined && pathBasename(effectiveConfig).toLowerCase() === 'package.json';
  const pkgBuildInputs = {
    ...inputs.build,
    config: cfgIsPackageJson ? undefined : effectiveConfig,
  };
  // Fold the pkg invocation into its own group — "Walking dependencies",
  // "Downloading nodejs executable", "Generating SEA assets", plus the
  // GH-Actions `[command]` echo and any warnings, can easily be 30+ lines
  // on a multi-target run. The summary line below the group gives wall
  // time at a glance without expanding.
  // runPkg logs the full command itself via "Invoking: …" — no need to
  // pre-log the argv here.
  const pkgTargetsLabel = resolvedTargets.map(formatTarget).join(', ');
  logger.startGroup(`[pkg-action] pkg build (targets=${pkgTargetsLabel})`);
  const runStart = Date.now();
  try {
    await runPkg(
      {
        build: pkgBuildInputs,
        targets: resolvedTargets,
        outputDir: pkgOutputDir,
        cwd: projectDir,
      },
      { exec: execBridge, logger, pkgCommand },
    );
  } finally {
    logger.endGroup();
  }
  const pkgDurationMs = Date.now() - runStart;
  logger.info(`[pkg-action] pkg finished in ${formatSeconds(pkgDurationMs)}`);

  // 6. Reconcile on-disk outputs to targets.
  const pkgOutputs = await mapPkgOutputs(resolvedTargets, project.name, pkgOutputDir);

  // 6.5. Parse Windows metadata once. Returns null when no windows-* input is
  //      set — we skip the resedit step entirely in that common case.
  const windowsMeta = await parseWindowsMetadataInputs();
  if (windowsMeta !== null) {
    logger.info('[pkg-action] Windows metadata detected — will patch win-* binaries post-rename.');
  }

  // 6.6. Parse signing config. Null when nothing is configured — the common
  //      dev-loop path. Any validation failure surfaces as a single
  //      setFailed before we touch any binary.
  const signing = parseSigningInputs({ registerSecret: (v) => core.setSecret(v) });
  if (signing !== null) {
    logger.info(
      `[pkg-action] Signing configured — macOS=${String(signing.macos !== undefined)}, windows=${signing.windowsMode}.`,
    );
  }

  // 7. Per-binary finalize.
  const finalDir = join(invocationDir, 'final');
  await mkdir(finalDir, { recursive: true });

  const finalizedBinaries: string[] = [];
  const finalizedArtifacts: string[] = [];
  const shasumEntries: Array<{ algo: ChecksumAlgorithm; path: string; digest: string }> = [];
  const summaryRows: SummaryRow[] = [];
  // Per-artifact digest map keyed by basename — consumed by the `digests`
  // output so callers can verify without reading SHASUMS files off disk.
  const digestsByArtifact: Record<string, Partial<Record<ChecksumAlgorithm, string>>> = {};

  for (const out of pkgOutputs) {
    const tokens = tokensForTarget(out.target, project, process.env);
    const renamedBase = render(inputs.postBuild.filename, tokens);
    const needsExe = out.target.os === 'win' && !renamedBase.toLowerCase().endsWith('.exe');
    const renamed = needsExe ? `${renamedBase}.exe` : renamedBase;
    const renamedPath = join(finalDir, renamed);
    await rename(out.path, renamedPath);

    // Group per-target work in the GH Actions log so each target folds
    // into its own collapsible section — makes matrix logs scannable.
    logger.startGroup(`[pkg-action] finalize ${formatTarget(out.target)} → ${renamed}`);
    try {
      // 7.5. Patch Windows metadata in-place before archiving. Only win-*
      //      targets receive a PE resource section; the call is a no-op
      //      otherwise, but skipping it avoids reading the binary off disk.
      if (windowsMeta !== null && out.target.os === 'win') {
        const perBinary: WindowsMetadataInputs = {
          ...windowsMeta,
          originalFilename: windowsMeta.originalFilename ?? pathBasename(renamedPath),
        };
        await applyWindowsMetadata(renamedPath, renamedPath, perBinary);
        logger.info(`[pkg-action] Patched Windows resources on ${renamedPath}.`);
      }

      // 7.6. Sign the binary, if configured for this target's OS. We sign
      //      AFTER the metadata patch (signing covers the whole binary
      //      including its resource section) and BEFORE archive/checksum
      //      so the shasum reflects the signed bytes.
      let signedFlag = false;
      if (signing !== null) {
        signedFlag = await signOneTarget(
          { targetOs: out.target.os, binaryPath: renamedPath },
          signing,
          {
            exec: execBridge,
            logger,
            tempDir: invocationDir,
          },
        );
      }

      finalizedBinaries.push(renamedPath);

      let finalPath: string;
      if (inputs.postBuild.compress === 'none') {
        finalPath = renamedPath;
      } else {
        logger.info(
          `[pkg-action] archive → ${pathBasename(renamedPath)} (format=${inputs.postBuild.compress})`,
        );
        const archStart = Date.now();
        finalPath = await archiveBinary(out, renamedPath, inputs, tokens);
        const archSize = (await stat(finalPath)).size;
        logger.info(
          `[pkg-action] archived ${pathBasename(finalPath)} (${formatBytes(archSize)}, ${formatSeconds(Date.now() - archStart)})`,
        );
      }
      finalizedArtifacts.push(finalPath);

      // Checksums — log each digest so a downstream failure trivially
      // diffs against a local recompute.
      const rowDigest = await finalizeChecksums(finalPath, inputs.postBuild.checksum);
      for (const entry of rowDigest.entries) {
        shasumEntries.push(entry);
        logger.info(`[pkg-action] ${entry.algo} ${entry.digest}  ${pathBasename(finalPath)}`);
      }
      if (rowDigest.entries.length > 0) {
        const key = pathBasename(finalPath);
        const byAlgo: Partial<Record<ChecksumAlgorithm, string>> = {};
        for (const entry of rowDigest.entries) byAlgo[entry.algo] = entry.digest;
        digestsByArtifact[key] = byAlgo;
      }

      const { size } = await stat(finalPath);
      const row: SummaryRow = {
        target: formatTarget(out.target),
        filename: finalPath,
        sizeBytes: size,
        ...(signedFlag ? { signed: true } : {}),
      };
      if (rowDigest.primary !== undefined) {
        (row as { primaryDigest?: { algo: ChecksumAlgorithm; value: string } }).primaryDigest =
          rowDigest.primary;
      }
      summaryRows.push(row);
    } finally {
      logger.endGroup();
    }
  }

  // 8. Combined SHASUMS file(s) — one per requested algo.
  const shasumsFiles: string[] = [];
  if (shasumEntries.length > 0) {
    for (const algo of inputs.postBuild.checksum) {
      const entries = shasumEntries.filter((e) => e.algo === algo);
      if (entries.length === 0) continue;
      const shasumPath = join(finalDir, `SHASUMS${algo.toUpperCase()}.txt`);
      await writeShasumsFile(shasumPath, entries);
      shasumsFiles.push(shasumPath);
      logger.info(
        `[pkg-action] wrote ${pathBasename(shasumPath)} (${String(entries.length)} entr${entries.length === 1 ? 'y' : 'ies'})`,
      );
    }
  }

  // 9. Step summary.
  if (inputs.performance.stepSummary) {
    const durationForFirst =
      summaryRows.length > 0 ? Math.round(pkgDurationMs / summaryRows.length) : undefined;
    const rowsWithTime = summaryRows.map((r) =>
      durationForFirst !== undefined ? { ...r, durationMs: durationForFirst } : r,
    );
    await writeSummary(rowsWithTime, {
      actionVersion: VERSION,
      pkgVersion: inputs.build.pkgVersion,
    });
  }

  // 10. Outputs.
  core.setOutput('binaries', JSON.stringify(finalizedBinaries));
  core.setOutput('artifacts', JSON.stringify(finalizedArtifacts));
  core.setOutput('checksums', JSON.stringify(shasumsFiles));
  core.setOutput('digests', JSON.stringify(digestsByArtifact));
  core.setOutput('version', project.version);

  logger.info(
    `pkg-action build — done (${String(pkgOutputs.length)} binary/binaries in ${formatSeconds(Date.now() - overallStart)})`,
  );
}

// ─── Log helpers ──────────────────────────────────────────────────────────

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function signOneTarget(
  spec: { targetOs: Target['os']; binaryPath: string },
  signing: SigningInputs,
  deps: { exec: ExecFn; logger: Logger; tempDir: string },
): Promise<boolean> {
  if (spec.targetOs === 'macos' && signing.macos !== undefined) {
    const cleanup = await signMacos(spec.binaryPath, signing.macos, deps);
    // Hand off to post.ts so the ephemeral keychain is torn down even on
    // a later failure. We append instead of overwriting so multiple targets
    // (unlikely with macOS, but safe) don't drop each other.
    const prior = core.getState('macosKeychains');
    const next = prior === '' ? cleanup.keychainPath : `${prior}\n${cleanup.keychainPath}`;
    core.saveState('macosKeychains', next);
    return true;
  }
  if (spec.targetOs === 'win') {
    if (signing.windowsMode === 'signtool' && signing.windowsSigntool !== undefined) {
      await signWindowsSigntool(spec.binaryPath, signing.windowsSigntool, deps);
      return true;
    }
    if (signing.windowsMode === 'trusted-signing' && signing.windowsTrusted !== undefined) {
      await signWindowsTrustedSigning(spec.binaryPath, signing.windowsTrusted, deps);
      return true;
    }
  }
  return false;
}

async function archiveBinary(
  out: OutputEntry,
  renamedPath: string,
  inputs: ActionInputs,
  tokens: Parameters<typeof render>[1],
): Promise<string> {
  const baseName = renamedPath.substring(0, renamedPath.length - extSuffix(renamedPath).length);
  const archiveExt = archiveExtFor(inputs.postBuild.compress);
  if (archiveExt === undefined) return renamedPath;
  const archivePath = `${baseName}.${archiveExt}`;
  await archive(
    {
      inputPath: renamedPath,
      outputPath: archivePath,
      // Use the same rendered basename inside the archive.
      format: inputs.postBuild.compress as 'tar.gz' | 'tar.xz' | 'zip' | '7z',
      entryName:
        render(inputs.postBuild.filename, tokens) + (out.target.os === 'win' ? '.exe' : ''),
    },
    { exec: execBridge },
  );
  return archivePath;
}

function extSuffix(path: string): string {
  // Return just the last extension; used to strip .exe before appending the archive suffix.
  const idx = path.lastIndexOf('.');
  if (idx === -1) return '';
  // Guard against very long names — only strip if the extension is <=5 chars.
  const ext = path.slice(idx);
  return ext.length <= 5 ? ext : '';
}

function archiveExtFor(format: string): string | undefined {
  if (format === 'tar.gz') return 'tar.gz';
  if (format === 'tar.xz') return 'tar.xz';
  if (format === 'zip') return 'zip';
  if (format === '7z') return '7z';
  return undefined;
}

interface ChecksumRoundup {
  readonly entries: Array<{ algo: ChecksumAlgorithm; path: string; digest: string }>;
  readonly primary: { algo: ChecksumAlgorithm; value: string } | undefined;
}

async function finalizeChecksums(
  filePath: string,
  algos: readonly ChecksumAlgorithm[],
): Promise<ChecksumRoundup> {
  if (algos.length === 0) return { entries: [], primary: undefined };
  const digests = await computeAllChecksums(filePath, algos);
  const entries: Array<{ algo: ChecksumAlgorithm; path: string; digest: string }> = [];
  for (const algo of algos) {
    const digest = digests[algo];
    const sidecar = await writeSidecar(filePath, digest, algo);
    entries.push({ algo, path: sidecar, digest });
  }
  const firstAlgo = algos[0];
  const primaryDigest = firstAlgo !== undefined ? digests[firstAlgo] : undefined;
  return {
    entries,
    primary:
      firstAlgo !== undefined && primaryDigest !== undefined
        ? { algo: firstAlgo, value: primaryDigest }
        : undefined,
  };
}

main().catch((err: unknown) => {
  core.setFailed(formatErrorChain(err));
});
