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
import { basename as pathBasename, dirname, join, resolve as pathResolve } from 'node:path';
import {
  actionsLogger,
  applyWindowsMetadata,
  archive,
  buildPkgArgs,
  buildReleaseAssetUrl,
  buildReleaseBody,
  collectDependencyTree,
  computeAllChecksums,
  createDefaultDistributionPublisher,
  createDefaultReleaseAttacher,
  createInvocationTemp,
  extractTagFromRef,
  formatErrorChain,
  formatTarget,
  hostTarget,
  mapPkgOutputs,
  newSbomSerialNumber,
  nowTimestamp,
  parseInputs,
  parseSigningInputs,
  parseWindowsMetadataInputs,
  readProjectInfo,
  render,
  renderHomebrewFormula,
  renderScoopManifest,
  resolveRepoFromEnv,
  runPkg,
  signMacos,
  signWindowsSigntool,
  signWindowsTrustedSigning,
  tokensForTarget,
  uploadArtifacts,
  writeSbom,
  writeShasumsFile,
  writeSidecar,
  writeSummary,
  closestInputName,
  VERSION,
  type ActionInputs,
  type ChecksumAlgorithm,
  type DistAsset,
  type ExecFn,
  type HomebrewInputs,
  type Logger,
  type OutputEntry,
  type ReleaseAsset,
  type ReleaseAttachRequest,
  type SbomArtifactRef,
  type ScoopInputs,
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
  const runnerTemp = process.env['RUNNER_TEMP'] ?? (await import('node:os')).tmpdir();
  const invocationDir = await createInvocationTemp(runnerTemp);
  core.saveState('invocationDir', invocationDir);
  const pkgOutputDir = join(invocationDir, 'pkg-out');
  await mkdir(pkgOutputDir, { recursive: true });

  // 5. Run pkg from the project directory.
  //
  // When a package.json was used to locate the project, drop the explicit
  // `--config` flag — pkg will pick up the local package.json via the
  // positional `.` argument. Otherwise keep `--config` (it points at a
  // standalone pkg config like .pkgrc.json).
  const pkgCommand = inputs.build.pkgPath ?? 'pkg';
  const cfgIsPackageJson =
    inputs.build.config !== undefined &&
    pathBasename(inputs.build.config).toLowerCase() === 'package.json';
  const pkgBuildInputs = cfgIsPackageJson ? { ...inputs.build, config: undefined } : inputs.build;
  const pkgArgs = buildPkgArgs({
    build: pkgBuildInputs,
    targets: resolvedTargets,
    outputDir: pkgOutputDir,
  });
  logger.info(`[pkg-action] pkg ${pkgArgs.join(' ')}`);
  const started = Date.now();
  await runPkg(
    {
      build: pkgBuildInputs,
      targets: resolvedTargets,
      outputDir: pkgOutputDir,
      cwd: projectDir,
    },
    { exec: execBridge, logger, pkgCommand },
  );
  const pkgDurationMs = Date.now() - started;

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
  // Per-target provenance used later for Homebrew/Scoop distribution. Only
  // populated when we have a sha256 digest to anchor the downstream manifest.
  const distAssetDrafts: Array<{
    target: Target;
    assetName: string;
    sha256: string | undefined;
    extractDir: string;
  }> = [];

  for (const out of pkgOutputs) {
    const tokens = tokensForTarget(out.target, project, process.env);
    const renamedBase = render(inputs.postBuild.filename, tokens);
    const needsExe = out.target.os === 'win' && !renamedBase.toLowerCase().endsWith('.exe');
    const renamed = needsExe ? `${renamedBase}.exe` : renamedBase;
    const renamedPath = join(finalDir, renamed);
    await rename(out.path, renamedPath);

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
      ...(signedFlag ? { signed: true } : {}),
    };
    if (rowDigest.primary !== undefined) {
      (row as { primaryDigest?: { algo: ChecksumAlgorithm; value: string } }).primaryDigest =
        rowDigest.primary;
    }
    summaryRows.push(row);

    // Record a distribution draft. sha256 must be present for Homebrew/Scoop;
    // we look it up from shasumEntries rather than recomputing.
    const sha256Entry = rowDigest.entries.find((e) => e.algo === 'sha256');
    const extractDir =
      inputs.postBuild.compress === 'none' ? '' : pathBasename(renamedPath).replace(/\.exe$/i, '');
    distAssetDrafts.push({
      target: out.target,
      assetName: pathBasename(finalPath),
      sha256: sha256Entry?.digest,
      extractDir,
    });
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

  // 8.5. SBOM generation (M6.2). Runs when sbom != none. Walks production
  //      deps of the project and emits either CycloneDX 1.5 or SPDX 2.3 JSON
  //      to the final dir so it rides along with the upload + release-attach
  //      steps.
  let sbomPath: string | undefined;
  if (inputs.performance.sbom !== 'none') {
    const deps = await collectDependencyTree(projectDir);
    const artifactRefs: SbomArtifactRef[] = finalizedArtifacts.map((artifact) => {
      const hashes = shasumEntries
        .filter((e) => e.path.startsWith(artifact))
        .map((e) => ({
          algo:
            e.algo === 'sha256'
              ? ('SHA-256' as const)
              : e.algo === 'sha512'
                ? ('SHA-512' as const)
                : ('MD5' as const),
          value: e.digest,
        }));
      return { filename: pathBasename(artifact), hashes };
    });
    sbomPath = await writeSbom({
      format: inputs.performance.sbom,
      outDir: finalDir,
      data: {
        project,
        deps,
        artifacts: artifactRefs,
        actionVersion: VERSION,
        timestamp: nowTimestamp(),
        serialNumber: newSbomSerialNumber(),
      },
    });
    logger.info(`[pkg-action] SBOM (${inputs.performance.sbom}) written: ${sbomPath}`);
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
    if (sbomPath !== undefined) {
      uploadRequests.push({
        name: `${project.name}-${project.version}-sbom`,
        files: [sbomPath],
        rootDirectory: finalDir,
      });
    }
    await uploadArtifacts(uploadRequests, { artifact: uploader, logger });
  }

  // 10. Release attachment. Runs when attach-to-release=true and a tag is
  //     resolvable from either GITHUB_REF or the release-tag override. The
  //     parser already enforced that at least one source exists, so any
  //     missing tag here is a logic bug.
  let releaseUrl: string | undefined;
  if (inputs.publishing.attachToRelease) {
    const tagFromRef = extractTagFromRef(process.env['GITHUB_REF']);
    const tag = inputs.publishing.releaseTag ?? tagFromRef;
    const repo = resolveRepoFromEnv(process.env);
    if (tag === undefined || repo === undefined) {
      core.setFailed(
        'attach-to-release=true but no tag or owner/repo could be resolved from the runner env.',
      );
      return;
    }
    const githubToken = process.env['GITHUB_TOKEN'];
    if (githubToken === undefined || githubToken === '') {
      core.setFailed(
        'attach-to-release=true requires GITHUB_TOKEN in env. Set it via `env: { GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} }`.',
      );
      return;
    }

    const generatedBody = inputs.publishing.generateReleaseTable
      ? buildReleaseBody({
          userBody: inputs.publishing.releaseBody,
          rows: summaryRows,
          actionVersion: VERSION,
        })
      : inputs.publishing.releaseBody;

    const assets: ReleaseAsset[] = [];
    for (const artifact of finalizedArtifacts) {
      assets.push({ path: artifact, name: pathBasename(artifact) });
    }
    for (const shasumFile of shasumsFiles) {
      assets.push({ path: shasumFile, name: pathBasename(shasumFile) });
    }
    if (sbomPath !== undefined) {
      assets.push({ path: sbomPath, name: pathBasename(sbomPath) });
    }

    const attacher = await createDefaultReleaseAttacher(githubToken, { createIfMissing: true });
    const req: ReleaseAttachRequest = {
      owner: repo.owner,
      repo: repo.repo,
      tag,
      assets,
      replace: true,
      ...(inputs.publishing.releaseName !== undefined
        ? { name: inputs.publishing.releaseName }
        : {}),
      ...(generatedBody !== undefined ? { body: generatedBody } : {}),
      draft: inputs.publishing.releaseDraft,
      prerelease: inputs.publishing.releasePrerelease,
    };
    const result = await attacher.attach(req);
    releaseUrl = result.releaseUrl;
    logger.info(
      `[pkg-action] Release attached: ${releaseUrl} (${String(result.assetUrls.length)} asset(s)).`,
    );

    // 10.5. Downstream distribution (M6.4 / M6.5). The parser guarantees both
    //       publishers are gated on attach-to-release=true, so we only arrive
    //       here when a tag + owner/repo + release URL are all in hand.
    const distAssets: DistAsset[] = distAssetDrafts
      .filter((d) => d.sha256 !== undefined)
      .map((d) => ({
        os: d.target.os as DistAsset['os'],
        arch: d.target.arch,
        url: buildReleaseAssetUrl(repo.owner, repo.repo, tag, d.assetName),
        sha256: d.sha256 as string,
        assetName: d.assetName,
        extractDir: d.extractDir,
      }));
    if (inputs.publishing.homebrew !== undefined) {
      await publishHomebrew(inputs.publishing.homebrew, {
        project,
        repo,
        tag,
        distAssets,
        defaultToken: githubToken,
        logger,
      });
    }
    if (inputs.publishing.scoop !== undefined) {
      await publishScoop(inputs.publishing.scoop, {
        project,
        repo,
        tag,
        distAssets,
        defaultToken: githubToken,
        logger,
      });
    }
  }

  // 11. Step summary.
  if (inputs.performance.stepSummary) {
    const durationForFirst =
      summaryRows.length > 0 ? Math.round(pkgDurationMs / summaryRows.length) : undefined;
    const rowsWithTime = summaryRows.map((r) =>
      durationForFirst !== undefined ? { ...r, durationMs: durationForFirst } : r,
    );
    const summaryOpts: {
      actionVersion: string;
      pkgVersion: string;
      releaseUrl?: string;
    } = {
      actionVersion: VERSION,
      pkgVersion: inputs.build.pkgVersion,
    };
    if (releaseUrl !== undefined) summaryOpts.releaseUrl = releaseUrl;
    await writeSummary(rowsWithTime, summaryOpts);
  }

  // 12. Outputs.
  core.setOutput('binaries', JSON.stringify(finalizedBinaries));
  core.setOutput('artifacts', JSON.stringify(finalizedArtifacts));
  core.setOutput('checksums', JSON.stringify(shasumsFiles));
  core.setOutput('version', project.version);
  if (releaseUrl !== undefined) core.setOutput('release-url', releaseUrl);

  logger.info(`pkg-action build — done (${String(pkgOutputs.length)} binary/binaries produced)`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

interface PublishDeps {
  readonly project: { name: string; version: string };
  readonly repo: { owner: string; repo: string };
  readonly tag: string;
  readonly distAssets: readonly DistAsset[];
  readonly defaultToken: string;
  readonly logger: Logger;
}

function parseRepoSlug(slug: string, flagName: string): { owner: string; repo: string } {
  const parts = slug.split('/');
  const owner = parts[0];
  const repo = parts[1];
  if (owner === undefined || repo === undefined || owner === '' || repo === '') {
    throw new Error(`${flagName} must be "owner/repo", got "${slug}".`);
  }
  return { owner, repo };
}

async function publishHomebrew(inputs: HomebrewInputs, deps: PublishDeps): Promise<void> {
  const target = parseRepoSlug(inputs.tapRepo, 'homebrew-tap-repo');
  const macAssets = deps.distAssets.filter((a) => a.os === 'macos');
  const linuxAssets = deps.distAssets.filter((a) => a.os === 'linux');
  if (macAssets.length === 0 && linuxAssets.length === 0) {
    deps.logger.warning(
      '[pkg-action] homebrew-tap-repo set but no macOS or Linux binary was built — skipping Homebrew publish.',
    );
    return;
  }
  const formulaName = inputs.formulaName ?? deps.project.name;
  const description = inputs.formulaDescription ?? `${deps.project.name} — pkg-action build`;
  const homepage =
    inputs.formulaHomepage ?? `https://github.com/${deps.repo.owner}/${deps.repo.repo}`;
  const body = renderHomebrewFormula({
    formulaName,
    description,
    homepage,
    version: deps.project.version,
    license: inputs.formulaLicense,
    assets: [...macAssets, ...linuxAssets],
    ...(inputs.formulaBinary !== undefined ? { binary: inputs.formulaBinary } : {}),
  });
  const branch = inputs.tapBranch ?? `pkg-action/${deps.project.name}-${deps.project.version}`;
  const publisher = await createDefaultDistributionPublisher(inputs.tapToken ?? deps.defaultToken);
  const result = await publisher.publish({
    owner: target.owner,
    repo: target.repo,
    branch,
    path: `Formula/${formulaName}.rb`,
    content: body,
    commitMessage: `${formulaName} ${deps.project.version}`,
    pullRequest: {
      title: `${formulaName} ${deps.project.version}`,
      body: `Automated update by yao-pkg/pkg-action for ${deps.project.name}@${deps.project.version}.\n\nRelease: ${deps.tag}`,
    },
  });
  deps.logger.info(
    `[pkg-action] Homebrew formula updated on ${inputs.tapRepo}@${branch}` +
      (result.pullRequestUrl !== undefined ? ` → PR ${result.pullRequestUrl}` : ''),
  );
}

async function publishScoop(inputs: ScoopInputs, deps: PublishDeps): Promise<void> {
  const target = parseRepoSlug(inputs.bucketRepo, 'scoop-bucket-repo');
  const winAssets = deps.distAssets.filter((a) => a.os === 'win');
  if (winAssets.length === 0) {
    deps.logger.warning(
      '[pkg-action] scoop-bucket-repo set but no Windows binary was built — skipping Scoop publish.',
    );
    return;
  }
  const manifestName = inputs.manifestName ?? deps.project.name;
  const description = inputs.manifestDescription ?? `${deps.project.name} — pkg-action build`;
  const homepage =
    inputs.manifestHomepage ?? `https://github.com/${deps.repo.owner}/${deps.repo.repo}`;
  const body = renderScoopManifest({
    manifestName,
    description,
    homepage,
    version: deps.project.version,
    license: inputs.manifestLicense,
    assets: winAssets,
    ...(inputs.manifestBinary !== undefined ? { binary: inputs.manifestBinary } : {}),
  });
  const branch = inputs.bucketBranch ?? `pkg-action/${deps.project.name}-${deps.project.version}`;
  const publisher = await createDefaultDistributionPublisher(
    inputs.bucketToken ?? deps.defaultToken,
  );
  const result = await publisher.publish({
    owner: target.owner,
    repo: target.repo,
    branch,
    path: `bucket/${manifestName}.json`,
    content: body,
    commitMessage: `${manifestName} ${deps.project.version}`,
    pullRequest: {
      title: `${manifestName} ${deps.project.version}`,
      body: `Automated update by yao-pkg/pkg-action for ${deps.project.name}@${deps.project.version}.\n\nRelease: ${deps.tag}`,
    },
  });
  deps.logger.info(
    `[pkg-action] Scoop manifest updated on ${inputs.bucketRepo}@${branch}` +
      (result.pullRequestUrl !== undefined ? ` → PR ${result.pullRequestUrl}` : ''),
  );
}

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
