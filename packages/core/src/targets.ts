// Target triple parsing, runner-label map, matrix expansion, cross-compile
// risk detection. The canonical GitHub runner label map lives here — GH
// deprecates labels on its own schedule and we update them in this one place.
//
// pkg target grammar (from @yao-pkg/pkg): `node{N}-{os}-{arch}` where
//   N   — Node major version, an integer (22, 24, …)
//   os  — linux | macos | win | alpine | linuxstatic
//   arch — x64 | arm64 | armv7 | armv6 | ppc64 | s390x
// Some triples (e.g. `latest-macos-arm64`) use `latest` for N. We accept it.

import { ValidationError } from './errors.ts';

export type TargetOs = 'linux' | 'macos' | 'win' | 'alpine' | 'linuxstatic';

export type TargetArch = 'x64' | 'arm64' | 'armv7' | 'armv6' | 'ppc64' | 's390x';

export interface Target {
  /** `22`, `24`, … or the literal string `'latest'`. */
  readonly node: number | 'latest';
  readonly os: TargetOs;
  readonly arch: TargetArch;
}

const VALID_OS: readonly TargetOs[] = ['linux', 'macos', 'win', 'alpine', 'linuxstatic'];
const VALID_ARCH: readonly TargetArch[] = ['x64', 'arm64', 'armv7', 'armv6', 'ppc64', 's390x'];

const TRIPLE_RE = /^(?:node(\d+)|(latest))-([a-z]+)-([a-z0-9]+)$/;

export function parseTarget(triple: string): Target {
  const trimmed = triple.trim();
  const m = TRIPLE_RE.exec(trimmed);
  if (!m) {
    throw new ValidationError(
      `Invalid target triple "${triple}". Expected node<N>-<os>-<arch> or latest-<os>-<arch>.`,
    );
  }
  const [, majorStr, latestLit, osRaw, archRaw] = m;
  const node: Target['node'] = latestLit !== undefined ? 'latest' : Number(majorStr);
  if (typeof node === 'number' && (Number.isNaN(node) || node < 18)) {
    throw new ValidationError(
      `Target "${triple}" specifies Node ${String(node)} — only Node 18 and newer are supported by pkg.`,
    );
  }
  if (!osRaw || !archRaw) {
    throw new ValidationError(`Invalid target triple "${triple}".`);
  }
  if (!VALID_OS.includes(osRaw as TargetOs)) {
    throw new ValidationError(
      `Invalid target OS "${osRaw}" in "${triple}". Expected one of: ${VALID_OS.join(', ')}.`,
    );
  }
  if (!VALID_ARCH.includes(archRaw as TargetArch)) {
    throw new ValidationError(
      `Invalid target arch "${archRaw}" in "${triple}". Expected one of: ${VALID_ARCH.join(', ')}.`,
    );
  }
  return {
    node,
    os: osRaw as TargetOs,
    arch: archRaw as TargetArch,
  };
}

export function formatTarget(t: Target): string {
  const nodePart = t.node === 'latest' ? 'latest' : `node${t.node}`;
  return `${nodePart}-${t.os}-${t.arch}`;
}

/** Parse a list input — accepts comma- and newline-separated. */
export function parseTargetList(raw: string): Target[] {
  const pieces = raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const seen = new Set<string>();
  const result: Target[] = [];
  for (const p of pieces) {
    const t = parseTarget(p);
    const key = formatTarget(t);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(t);
    }
  }
  return result;
}

// Runner label map. Illustrative; GH deprecates labels on its own schedule —
// bump here when labels change. These are the GH-hosted defaults; self-hosted
// users override per-target via the `runner-overrides` input.
export const DEFAULT_RUNNER_LABELS: Readonly<Record<string, string>> = Object.freeze({
  'linux-x64': 'ubuntu-latest',
  'linux-arm64': 'ubuntu-24.04-arm',
  'linuxstatic-x64': 'ubuntu-latest',
  'linuxstatic-arm64': 'ubuntu-24.04-arm',
  'alpine-x64': 'ubuntu-latest',
  'alpine-arm64': 'ubuntu-24.04-arm',
  'macos-x64': 'macos-13',
  'macos-arm64': 'macos-latest',
  'win-x64': 'windows-latest',
  'win-arm64': 'windows-11-arm',
});

/** Runner label for a target, honoring user overrides. */
export function runnerFor(
  target: Target,
  overrides: Readonly<Record<string, string>> = {},
): string {
  const key = `${target.os}-${target.arch}`;
  // Allow override by full triple OR by os-arch shortcut.
  const triple = formatTarget(target);
  const override = overrides[triple] ?? overrides[key];
  if (override !== undefined) return override;
  const label = DEFAULT_RUNNER_LABELS[key];
  if (label === undefined) {
    throw new ValidationError(
      `No default runner label known for target ${triple}. Pass a runner-overrides entry.`,
    );
  }
  return label;
}

export interface MatrixEntry {
  readonly target: string; // full triple
  readonly runner: string;
}

export function expandMatrix(
  targets: Target[],
  overrides: Readonly<Record<string, string>> = {},
): MatrixEntry[] {
  return targets.map((t) => ({
    target: formatTarget(t),
    runner: runnerFor(t, overrides),
  }));
}

/**
 * Host target — best-effort reconstruction of the current machine's triple.
 * Used when no `targets` input is supplied.
 *
 * Maps Node's process.platform → pkg's os, process.arch → pkg's arch.
 */
export function hostTarget(
  platform: NodeJS.Platform = process.platform,
  arch: NodeJS.Architecture = process.arch,
  nodeVersion: string = process.versions.node,
): Target {
  let os: TargetOs;
  switch (platform) {
    case 'linux':
      os = 'linux';
      break;
    case 'darwin':
      os = 'macos';
      break;
    case 'win32':
      os = 'win';
      break;
    default:
      throw new ValidationError(
        `Cannot auto-detect host target — unsupported platform "${platform}".`,
      );
  }
  let mappedArch: TargetArch;
  switch (arch) {
    case 'x64':
      mappedArch = 'x64';
      break;
    case 'arm64':
      mappedArch = 'arm64';
      break;
    case 'arm':
      mappedArch = 'armv7';
      break;
    case 'ppc64':
      mappedArch = 'ppc64';
      break;
    case 's390x':
      mappedArch = 's390x';
      break;
    default:
      throw new ValidationError(`Cannot auto-detect host target — unsupported arch "${arch}".`);
  }
  const nodeMajor = Number(nodeVersion.split('.')[0]);
  if (!Number.isFinite(nodeMajor)) {
    throw new ValidationError(`Cannot parse Node version "${nodeVersion}".`);
  }
  return { node: nodeMajor, os, arch: mappedArch };
}

/**
 * Known cross-compile landmines (plan §8, docs-site/guide/targets.md):
 *
 * 1. `node22-linux-arm64` fabrication bug on x64 hosts (pkg #87 / #181).
 * 2. `node22-win-x64` fabrication bug from non-Windows hosts.
 * 3. Linux→macOS produces non-functional binaries (pkg #183).
 * 4. macOS-arm64 requires valid signing, which a Linux host can only forge
 *    loosely via `ldid`.
 *
 * Returns a human-readable reason string when risky, or `null` when the
 * combination is expected to work. Not a fail — the matrix action's caller
 * decides whether to downgrade to warning via `allow-cross-compile`.
 */
export function crossCompileRisk(host: Target, target: Target): string | null {
  const sameOs = host.os === target.os;
  const sameArch = host.arch === target.arch;
  if (sameOs && sameArch) return null;

  // Linux → macOS never works reliably.
  if (host.os === 'linux' && target.os === 'macos') {
    return 'Linux host → macOS target produces non-functional binaries (see yao-pkg/pkg#183). Use a macOS runner.';
  }
  // Non-Linux → Linux-arm64 without QEMU hits the fabrication bug on Node 22.
  if (target.os === 'linux' && target.arch === 'arm64' && host.arch !== 'arm64') {
    return 'Linux-arm64 cross-compile from a non-arm64 host hits the pkg bytecode fabricator bug (#87/#181) on Node 22. Use a linux/arm64 runner or set `fallbackToSource: true` in your pkg config.';
  }
  // Non-Windows → win-x64 on Node 22 also hits the fabricator bug.
  if (target.os === 'win' && target.arch === 'x64' && host.os !== 'win') {
    return 'win-x64 cross-compile from a non-Windows host hits the pkg bytecode fabricator bug (#87/#181) on Node 22. Use a windows runner or set `fallbackToSource: true` in your pkg config.';
  }
  // macOS-arm64 requires signing.
  if (target.os === 'macos' && target.arch === 'arm64' && host.os !== 'macos') {
    return 'macos-arm64 binaries must be signed to run; cross-compiling without a codesign toolchain will produce an unusable binary.';
  }
  return null;
}
