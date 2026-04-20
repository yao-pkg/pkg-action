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
//     archive (if compress != none)
//     compute checksums
//     record summary row
//   writeSummary           → GITHUB_STEP_SUMMARY
//   setOutputs             → binaries / artifacts / checksums / version
//
// Runs via `node --experimental-strip-types` in dev, bundled by esbuild for
// production. Everything is DI-friendly so tests can fake pkg/exec/artifact.

import * as core from '@actions/core';
import { mkdir, rename, stat } from 'node:fs/promises';
import { join } from 'node:path';
import {
  actionsLogger,
  archive,
  buildPkgArgs,
  computeAllChecksums,
  createInvocationTemp,
  extractTagFromRef,
  formatErrorChain,
  formatTarget,
  hostTarget,
  mapPkgOutputs,
  parseInputs,
  readProjectInfo,
  render,
  resolveRepoFromEnv,
  runPkg,
  tokensForTarget,
  uploadArtifacts,
  writeShasumsFile,
  writeSidecar,
  writeSummary,
  closestInputName,
  VERSION,
  type ActionInputs,
  type ChecksumAlgorithm,
  type ExecFn,
  type OutputEntry,
  type SummaryRow,
  type Target,
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

  // 2. Project metadata + working dir.
  const cwd = process.cwd();
  const project = await readProjectInfo(cwd);
  logger.info(`[pkg-action] project: ${project.name}@${project.version}`);

  // 3. Resolve targets — 'host' → explicit host target.
  const resolvedTargets: Target[] =
    inputs.build.targets === 'host' ? [hostTarget()] : [...inputs.build.targets];
  logger.info(`[pkg-action] targets: ${resolvedTargets.map(formatTarget).join(', ')}`);

  // 4. Invocation-scoped temp dir + output dir.
  const runnerTemp = process.env['RUNNER_TEMP'] ?? (await import('node:os')).tmpdir();
  const invocationDir = await createInvocationTemp(runnerTemp);
  core.saveState('invocationDir', invocationDir);
  const pkgOutputDir = join(invocationDir, 'pkg-out');
  await mkdir(pkgOutputDir, { recursive: true });

  // 5. Run pkg.
  const pkgCommand = inputs.build.pkgPath ?? 'pkg';
  const pkgArgs = buildPkgArgs({
    build: inputs.build,
    targets: resolvedTargets,
    outputDir: pkgOutputDir,
  });
  logger.info(`[pkg-action] pkg ${pkgArgs.join(' ')}`);
  const started = Date.now();
  await runPkg(
    {
      build: inputs.build,
      targets: resolvedTargets,
      outputDir: pkgOutputDir,
      cwd,
    },
    { exec: execBridge, logger, pkgCommand },
  );
  const pkgDurationMs = Date.now() - started;

  // 6. Reconcile on-disk outputs to targets.
  const pkgOutputs = await mapPkgOutputs(resolvedTargets, project.name, pkgOutputDir);

  // 7. Per-binary finalize.
  const finalDir = join(invocationDir, 'final');
  await mkdir(finalDir, { recursive: true });

  const finalizedBinaries: string[] = [];
  const finalizedArtifacts: string[] = [];
  const shasumEntries: Array<{ algo: ChecksumAlgorithm; path: string; digest: string }> = [];
  const summaryRows: SummaryRow[] = [];

  for (const out of pkgOutputs) {
    const tokens = tokensForTarget(out.target, project, process.env);
    const renamedBase = render(inputs.postBuild.filename, tokens);
    const needsExe = out.target.os === 'win' && !renamedBase.toLowerCase().endsWith('.exe');
    const renamed = needsExe ? `${renamedBase}.exe` : renamedBase;
    const renamedPath = join(finalDir, renamed);
    await rename(out.path, renamedPath);
    finalizedBinaries.push(renamedPath);

    const finalPath =
      inputs.postBuild.compress === 'none'
        ? renamedPath
        : await archiveBinary(out, renamedPath, inputs, tokens);
    finalizedArtifacts.push(finalPath);

    // Checksums.
    const rowDigest = await finalizeChecksums(finalPath, inputs.postBuild.checksum);
    for (const entry of rowDigest.entries) shasumEntries.push(entry);

    const { size } = await stat(finalPath);
    const row: SummaryRow = {
      target: formatTarget(out.target),
      filename: finalPath,
      sizeBytes: size,
    };
    if (rowDigest.primary !== undefined) {
      (row as { primaryDigest?: { algo: ChecksumAlgorithm; value: string } }).primaryDigest =
        rowDigest.primary;
    }
    summaryRows.push(row);
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
    }
  }

  // 9. Artifact upload (one per target — names must be unique).
  if (inputs.publishing.uploadArtifact && finalizedArtifacts.length > 0) {
    const uploader = await (await import('@pkg-action/core')).createDefaultArtifactUploader();
    const uploadRequests = pkgOutputs.map((out, i) => {
      const tokens = tokensForTarget(out.target, project, process.env);
      const name = render(inputs.publishing.artifactName, tokens);
      const sidecarFiles = shasumEntries
        .filter(
          (e) => finalizedArtifacts[i] !== undefined && e.path.startsWith(finalizedArtifacts[i]),
        )
        .map((e) => e.path);
      const files = [finalizedArtifacts[i] as string, ...sidecarFiles];
      return { name, files, rootDirectory: finalDir };
    });
    await uploadArtifacts(uploadRequests, { artifact: uploader, logger });
  }

  // 10. Release attachment — if attach-to-release is set AND a tag is resolvable.
  //     Full implementation lands in M5; this is a stub wire-up so the plumbing
  //     exists when the M5 input validators expose attach-to-release.
  const tag = extractTagFromRef(process.env['GITHUB_REF']);
  const repo = resolveRepoFromEnv(process.env);
  if (tag !== undefined && repo !== undefined) {
    logger.debug(
      `[pkg-action] Detected tag ${tag} on ${repo.owner}/${repo.repo}; release attach is deferred to M5.`,
    );
  }

  // 11. Step summary.
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

  // 12. Outputs.
  core.setOutput('binaries', JSON.stringify(finalizedBinaries));
  core.setOutput('artifacts', JSON.stringify(finalizedArtifacts));
  core.setOutput('checksums', JSON.stringify(shasumsFiles));
  core.setOutput('version', project.version);

  logger.info(`pkg-action build — done (${String(pkgOutputs.length)} binary/binaries produced)`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

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
