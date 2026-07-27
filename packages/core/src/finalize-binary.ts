// Per-binary finalize pipeline — everything that happens to ONE pkg output
// between "pkg wrote a file" and "the artifact is ready to be uploaded":
//
//   apply filename template → move into place
//   (optional) patch Windows PE resources
//   (optional) sign (macOS codesign / Windows signtool / Azure Trusted Signing)
//   archive (when compress != 'none')
//   compute checksums (+ per-file sidecars)
//   build the step-summary row
//
// Extracted from the orchestrator so the sub-action stays wiring-only. Deps
// (exec, logger) are injected the same way signMacos / runPkg / archive take
// them, so the whole pipeline is unit-testable without touching a runner.
//
// One piece of wiring deliberately stays with the caller: the ephemeral macOS
// keychain path is RETURNED rather than saved to Actions state here, because
// the state handoff to post.ts is a sub-action concern, not a library one.

import { rename, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { archive } from './archive.ts';
import {
  computeAllChecksums,
  writeSidecar,
  type ChecksumAlgorithm,
  type ShasumEntry,
} from './checksum.ts';
import type { PostBuildInputs } from './inputs.ts';
import type { Logger } from './logger.ts';
import type { OutputEntry } from './pkg-output-map.ts';
import type { ExecFn } from './pkg-runner.ts';
import { tokensForTarget, type ProjectInfo } from './project-info.ts';
import {
  signMacos,
  signWindowsSigntool,
  signWindowsTrustedSigning,
  type SigningInputs,
} from './signing.ts';
import type { SummaryRow } from './summary.ts';
import { formatTarget, type Target } from './targets.ts';
import { render, type TemplateTokens } from './templates.ts';
import { applyWindowsMetadata } from './windows-metadata-apply.ts';
import type { WindowsMetadataInputs } from './windows-metadata.ts';

// ─── Types ────────────────────────────────────────────────────────────────

/** A SHASUMS line plus the algorithm that produced it. */
export interface ChecksumEntry extends ShasumEntry {
  readonly algo: ChecksumAlgorithm;
}

export interface FinalizeBinaryRequest {
  /** The pkg output being finalized — target triple + on-disk path. */
  readonly output: OutputEntry;
  /** Project name/version, used to render the filename template. */
  readonly project: Pick<ProjectInfo, 'name' | 'version'>;
  /** Filename template, archive format, checksum algorithms. */
  readonly postBuild: PostBuildInputs;
  /** Directory the finalized binary/artifact is moved into. Must exist. */
  readonly finalDir: string;
  /** Parsed windows-* inputs, or null when none were set. */
  readonly windowsMetadata: WindowsMetadataInputs | null;
  /** Parsed signing config, or null when nothing is configured. */
  readonly signing: SigningInputs | null;
  /** Invocation-scoped temp dir — where signing writes secret material. */
  readonly tempDir: string;
  /** Runner env used for the {sha}/{ref}/{tag}/{date} tokens. */
  readonly env?: Readonly<Record<string, string | undefined>>;
}

export interface FinalizeBinaryDeps {
  readonly exec: ExecFn;
  readonly logger: Logger;
}

export interface FinalizeBinaryResult {
  /** The renamed (and possibly patched/signed) binary. */
  readonly binaryPath: string;
  /** The archive when compress != 'none', otherwise the binary itself. */
  readonly artifactPath: string;
  /** One entry per requested algorithm; empty when checksum='none'. */
  readonly checksums: readonly ChecksumEntry[];
  /**
   * Digest map keyed by artifact basename — shaped for the `digests` output.
   * Empty when no checksums were requested.
   */
  readonly digests: Record<string, Partial<Record<ChecksumAlgorithm, string>>>;
  /** Step-summary row for this binary. */
  readonly row: SummaryRow;
  /**
   * Path of the ephemeral macOS keychain created while signing, when signing
   * ran. The caller must hand it to its post-job cleanup so the keychain is
   * torn down even if a later step fails.
   */
  readonly macosKeychain: string | undefined;
}

// ─── Pipeline ─────────────────────────────────────────────────────────────

/**
 * Finalize a single pkg output. Throws whatever the underlying step throws —
 * rename/resedit/sign/archive/checksum errors all propagate unwrapped so the
 * orchestrator can render one error chain.
 */
export async function finalizeBinary(
  req: FinalizeBinaryRequest,
  deps: FinalizeBinaryDeps,
): Promise<FinalizeBinaryResult> {
  const { output: out, postBuild } = req;
  const { logger } = deps;

  const tokens = tokensForTarget(out.target, req.project, req.env ?? process.env);
  const renamedBase = render(postBuild.filename, tokens);
  const needsExe = out.target.os === 'win' && !renamedBase.toLowerCase().endsWith('.exe');
  const renamed = needsExe ? `${renamedBase}.exe` : renamedBase;
  const renamedPath = join(req.finalDir, renamed);
  await rename(out.path, renamedPath);

  // Group per-target work in the GH Actions log so each target folds
  // into its own collapsible section — makes matrix logs scannable.
  logger.startGroup(`[pkg-action] finalize ${formatTarget(out.target)} → ${renamed}`);
  try {
    // Patch Windows metadata in-place before archiving. Only win-*
    // targets receive a PE resource section; the call is a no-op
    // otherwise, but skipping it avoids reading the binary off disk.
    if (req.windowsMetadata !== null && out.target.os === 'win') {
      const perBinary: WindowsMetadataInputs = {
        ...req.windowsMetadata,
        originalFilename: req.windowsMetadata.originalFilename ?? basename(renamedPath),
      };
      await applyWindowsMetadata(renamedPath, renamedPath, perBinary);
      logger.info(`[pkg-action] Patched Windows resources on ${renamedPath}.`);
    }

    // Sign the binary, if configured for this target's OS. We sign
    // AFTER the metadata patch (signing covers the whole binary
    // including its resource section) and BEFORE archive/checksum
    // so the shasum reflects the signed bytes.
    let signedFlag = false;
    let macosKeychain: string | undefined;
    if (req.signing !== null) {
      const signed = await signOneTarget(
        { targetOs: out.target.os, binaryPath: renamedPath },
        req.signing,
        { exec: deps.exec, logger, tempDir: req.tempDir },
      );
      signedFlag = signed.signed;
      macosKeychain = signed.macosKeychain;
    }

    let finalPath: string;
    if (postBuild.compress === 'none') {
      finalPath = renamedPath;
    } else {
      logger.info(`[pkg-action] archive → ${basename(renamedPath)} (format=${postBuild.compress})`);
      const archStart = Date.now();
      finalPath = await archiveBinary(out.target, renamedPath, postBuild, tokens, deps);
      const archSize = (await stat(finalPath)).size;
      logger.info(
        `[pkg-action] archived ${basename(finalPath)} (${formatBytes(archSize)}, ${formatSeconds(Date.now() - archStart)})`,
      );
    }

    // Checksums — log each digest so a downstream failure trivially
    // diffs against a local recompute.
    const rowDigest = await finalizeChecksums(finalPath, postBuild.checksum);
    for (const entry of rowDigest.entries) {
      logger.info(`[pkg-action] ${entry.algo} ${entry.digest}  ${basename(finalPath)}`);
    }
    const digests: Record<string, Partial<Record<ChecksumAlgorithm, string>>> = {};
    if (rowDigest.entries.length > 0) {
      const key = basename(finalPath);
      const byAlgo: Partial<Record<ChecksumAlgorithm, string>> = {};
      for (const entry of rowDigest.entries) byAlgo[entry.algo] = entry.digest;
      digests[key] = byAlgo;
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

    return {
      binaryPath: renamedPath,
      artifactPath: finalPath,
      checksums: rowDigest.entries,
      digests,
      row,
      macosKeychain,
    };
  } finally {
    logger.endGroup();
  }
}

// ─── Steps ────────────────────────────────────────────────────────────────

interface SignOutcome {
  readonly signed: boolean;
  /** Set only on the macOS path — the ephemeral keychain to tear down. */
  readonly macosKeychain: string | undefined;
}

async function signOneTarget(
  spec: { targetOs: Target['os']; binaryPath: string },
  signing: SigningInputs,
  deps: { exec: ExecFn; logger: Logger; tempDir: string },
): Promise<SignOutcome> {
  if (spec.targetOs === 'macos' && signing.macos !== undefined) {
    const cleanup = await signMacos(spec.binaryPath, signing.macos, deps);
    return { signed: true, macosKeychain: cleanup.keychainPath };
  }
  if (spec.targetOs === 'win') {
    if (signing.windowsMode === 'signtool' && signing.windowsSigntool !== undefined) {
      await signWindowsSigntool(spec.binaryPath, signing.windowsSigntool, deps);
      return { signed: true, macosKeychain: undefined };
    }
    if (signing.windowsMode === 'trusted-signing' && signing.windowsTrusted !== undefined) {
      await signWindowsTrustedSigning(spec.binaryPath, signing.windowsTrusted, deps);
      return { signed: true, macosKeychain: undefined };
    }
  }
  return { signed: false, macosKeychain: undefined };
}

async function archiveBinary(
  target: Target,
  renamedPath: string,
  postBuild: PostBuildInputs,
  tokens: TemplateTokens,
  deps: FinalizeBinaryDeps,
): Promise<string> {
  const baseName = renamedPath.substring(0, renamedPath.length - extSuffix(renamedPath).length);
  const archiveExt = archiveExtFor(postBuild.compress);
  if (archiveExt === undefined) return renamedPath;
  const archivePath = `${baseName}.${archiveExt}`;
  await archive(
    {
      inputPath: renamedPath,
      outputPath: archivePath,
      // Use the same rendered basename inside the archive.
      format: postBuild.compress as 'tar.gz' | 'tar.xz' | 'zip' | '7z',
      entryName: render(postBuild.filename, tokens) + (target.os === 'win' ? '.exe' : ''),
    },
    { exec: deps.exec },
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
  readonly entries: ChecksumEntry[];
  readonly primary: { algo: ChecksumAlgorithm; value: string } | undefined;
}

async function finalizeChecksums(
  filePath: string,
  algos: readonly ChecksumAlgorithm[],
): Promise<ChecksumRoundup> {
  if (algos.length === 0) return { entries: [], primary: undefined };
  const digests = await computeAllChecksums(filePath, algos);
  const entries: ChecksumEntry[] = [];
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
