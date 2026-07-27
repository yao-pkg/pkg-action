// Orchestrator — the `main` of the Node24 JS action at the repo root.
//
// Pipeline:
//   parseInputs            → typed input record (+ secret registration, typo warnings)
//   readProjectInfo        → package.json name + version
//   resolveTargets         → 'host' → hostTarget() | explicit list
//   restorePkgCache        → pkg-fetch downloads from a previous run
//   installPkg             → npm i -g @yao-pkg/pkg@<pkg-version>
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
import { mkdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename as pathBasename, dirname, join, resolve as pathResolve } from 'node:path';
import {
  actionsLogger,
  createInvocationTemp,
  finalizeBinary,
  formatErrorChain,
  formatTarget,
  hostTarget,
  installPkg,
  mapPkgOutputs,
  materializePkgConfigInline,
  parseInputs,
  parseSigningInputs,
  parseWindowsMetadataInputs,
  readProjectInfo,
  resolvePkgVersion,
  runPkg,
  ValidationError,
  writeShasumsFile,
  writeSummary,
  closestInputName,
  VERSION,
  type ActionInputs,
  type ChecksumAlgorithm,
  type ChecksumEntry,
  type ExecFn,
  type SummaryRow,
  type Target,
} from '@pkg-action/core';
import { restorePkgCache } from './pkg-cache-io.ts';

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
  // An explicit `config` names the project: its parent directory is the root,
  // whether it is a package.json or a standalone config sitting beside one.
  // That is where package.json — name, version, and the `bin` used as the entry
  // for a standalone config — is read from. A config kept away from the project
  // (say `configs/pkg.config.mjs`) has no package.json next to it, so fall back
  // to GITHUB_WORKSPACE (or cwd when running locally), as does an unset config.
  const workspace = process.env['GITHUB_WORKSPACE'] ?? process.cwd();
  const projectDir = await (async () => {
    const cfg = inputs.build.config;
    if (cfg === undefined) return workspace;
    const configDir = dirname(pathResolve(workspace, cfg));
    if (pathBasename(pathResolve(workspace, cfg)).toLowerCase() === 'package.json') {
      return configDir;
    }
    try {
      await stat(join(configDir, 'package.json'));
      return configDir;
    } catch {
      return workspace;
    }
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

  // 4.1. Point pkg-fetch at a known directory and restore its cache. Exported
  //      rather than merely set in-process so a later workflow step that shells
  //      out to pkg directly reuses the same downloads.
  const pkgCachePath = join(runnerTemp, 'pkg-cache');
  core.exportVariable('PKG_CACHE_PATH', pkgCachePath);
  if (inputs.performance.cache) {
    await restorePkgCache({
      cachePath: pkgCachePath,
      cacheKeyOverride: inputs.performance.cacheKey,
      logger,
    });
  }

  // 4.2. Install pkg unless the caller supplied one.
  if (inputs.build.pkgPath === undefined) {
    await installPkg(inputs.build.pkgVersion, { exec: execBridge, logger });
  }

  // 4.5. Materialize `config-inline` to disk, if set. parseInputs already
  //      validated it as a JSON object and enforced mutual exclusion with
  //      `config`, so the helper just writes the bytes and returns the path.
  const effectiveConfig = await materializePkgConfigInline({
    config: inputs.build.config,
    configInline: inputs.build.configInline,
    invocationDir,
  });
  if (inputs.build.configInline !== undefined && effectiveConfig !== undefined) {
    logger.info(`[pkg-action] materialized config-inline → ${effectiveConfig}`);
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
  const standaloneConfig = cfgIsPackageJson ? undefined : effectiveConfig;
  // pkg rejects `--config <file>` alongside a package.json input, and the
  // default positional `.` resolves to exactly that. So a standalone config
  // has to name the entry script explicitly.
  let entry = inputs.build.entry;
  if (standaloneConfig !== undefined && entry === undefined) {
    if (project.binEntry === undefined) {
      throw new ValidationError(
        `Input "${inputs.build.configInline !== undefined ? 'config-inline' : 'config'}" needs an entry script, ` +
          `but package.json at ${projectDir} has no "bin". Set the "entry" input, or add "bin" to package.json.`,
      );
    }
    entry = project.binEntry;
    logger.info(`[pkg-action] entry resolved from package.json bin → ${entry}`);
  }
  const pkgBuildInputs = {
    ...inputs.build,
    config: standaloneConfig,
    entry,
  };
  // Fold the pkg invocation into its own group — "Walking dependencies",
  // "Downloading nodejs executable", "Generating SEA assets", plus the
  // GH-Actions `[command]` echo and any warnings, can easily be 30+ lines
  // on a multi-target run. The summary line below the group gives wall
  // time at a glance without expanding.
  // runPkg logs the full command itself via "Invoking: …" — no need to
  // pre-log the argv here.
  const pkgTargetsLabel = resolvedTargets.map(formatTarget).join(', ');
  // Resolve before the build so the concrete version is in the log even when
  // pkg then fails — that is exactly the run you need to identify afterwards.
  const resolvedPkgVersion = await resolvePkgVersion({ exec: execBridge, logger, pkgCommand });
  logger.info(
    `[pkg-action] pkg ${resolvedPkgVersion ?? '(version unknown)'} (from "${inputs.build.pkgVersion}")`,
  );

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
  const shasumEntries: ChecksumEntry[] = [];
  const summaryRows: SummaryRow[] = [];
  // Per-artifact digest map keyed by basename — consumed by the `digests`
  // output so callers can verify without reading SHASUMS files off disk.
  const digestsByArtifact: Record<string, Partial<Record<ChecksumAlgorithm, string>>> = {};

  for (const out of pkgOutputs) {
    const result = await finalizeBinary(
      {
        output: out,
        project,
        postBuild: inputs.postBuild,
        finalDir,
        windowsMetadata: windowsMeta,
        signing,
        tempDir: invocationDir,
      },
      { exec: execBridge, logger },
    );

    finalizedBinaries.push(result.binaryPath);
    finalizedArtifacts.push(result.artifactPath);
    shasumEntries.push(...result.checksums);
    summaryRows.push(result.row);
    Object.assign(digestsByArtifact, result.digests);

    // Hand the ephemeral keychain off to post.ts so it is torn down even on a
    // later failure. Appending rather than overwriting keeps multiple targets
    // (unlikely with macOS, but safe) from dropping each other.
    if (result.macosKeychain !== undefined) {
      const prior = core.getState('macosKeychains');
      core.saveState(
        'macosKeychains',
        prior === '' ? result.macosKeychain : `${prior}\n${result.macosKeychain}`,
      );
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
      pkgVersion:
        resolvedPkgVersion !== undefined
          ? `${resolvedPkgVersion} (${inputs.build.pkgVersion})`
          : inputs.build.pkgVersion,
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

main().catch((err: unknown) => {
  core.setFailed(formatErrorChain(err));
});
