// Map pkg's on-disk output files back to their originating target triples.
//
// pkg's naming heuristic (lib/index.ts in yao-pkg/pkg, ~line 146-166, 513-527):
//
//   - 1 target  → the output is written with the user's chosen base name
//                (e.g. `app` or `app.exe` for Windows).
//   - N targets → the base name is suffixed with only the DIFFERING parts of
//                the target triple. If all targets share Node version, the
//                "nodeNN" part is omitted from the suffix; same for os and
//                arch. For a fully-diverging set:
//                  `app-linux-x64`, `app-macos-arm64`, `app-win-x64.exe`
//                but if you pass e.g. `node22-linux-x64,node22-macos-x64`
//                (same arch), the outputs are `app-linux`, `app-macos`.
//
//   - Windows targets always get `.exe` appended if missing.
//
// We REPLICATE the heuristic here, then verify each predicted file exists on
// disk. If a prediction misses, we fall back to listing the output directory
// and matching by basename prefix — that covers pkg-version drift.

import { access, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { formatTarget, type Target } from './targets.ts';
import { PkgRunError } from './errors.ts';

export interface OutputEntry {
  readonly target: Target;
  readonly path: string;
}

/**
 * Given the list of targets and the base name pkg was told to use, return
 * the predicted on-disk filename for each target (without directory).
 * The base name for a single target is the user's `output` flag OR the
 * project's package.json `name`. Callers pass the resolved base in `baseName`.
 */
export function predictOutputNames(targets: readonly Target[], baseName: string): string[] {
  if (targets.length === 0) return [];
  if (targets.length === 1) {
    const only = targets[0];
    if (!only) return [];
    return [withWindowsSuffix(baseName, only)];
  }

  // Multi-target: figure out which components diverge across the set.
  const nodes = new Set(targets.map((t) => String(t.node)));
  const oses = new Set(targets.map((t) => t.os));
  const archs = new Set(targets.map((t) => t.arch));
  const diverges = {
    node: nodes.size > 1,
    os: oses.size > 1,
    arch: archs.size > 1,
  };

  return targets.map((t) => {
    const parts: string[] = [baseName];
    if (diverges.node) parts.push(String(t.node));
    if (diverges.os) parts.push(t.os);
    if (diverges.arch) parts.push(t.arch);
    return withWindowsSuffix(parts.join('-'), t);
  });
}

function withWindowsSuffix(name: string, target: Target): string {
  if (target.os === 'win' && !name.toLowerCase().endsWith('.exe')) {
    return `${name}.exe`;
  }
  return name;
}

/**
 * Walk the output directory, pair each produced binary with its target. Uses
 * `predictOutputNames` first; if a predicted file is missing, falls back to
 * a basename-prefix match over the actual directory contents.
 */
export async function mapPkgOutputs(
  targets: readonly Target[],
  baseName: string,
  outputDir: string,
): Promise<OutputEntry[]> {
  const predicted = predictOutputNames(targets, baseName);
  const entries: OutputEntry[] = [];
  const unresolved: Array<{ target: Target; predicted: string }> = [];

  for (let i = 0; i < targets.length; i += 1) {
    const target = targets[i];
    const name = predicted[i];
    if (target === undefined || name === undefined) continue;
    const candidate = join(outputDir, name);
    const present = await exists(candidate);
    if (present) {
      entries.push({ target, path: candidate });
    } else {
      unresolved.push({ target, predicted: name });
    }
  }

  if (unresolved.length > 0) {
    // Fall back to a directory listing. Match by substring — the target triple
    // (or its diff-parts) uniquely identifies each file.
    const listing = await readdir(outputDir);
    for (const { target, predicted: predictedName } of unresolved) {
      const match = findFallbackMatch(listing, target, predictedName);
      if (match === undefined) {
        throw new PkgRunError(
          `pkg did not produce an output for ${formatTarget(target)}. ` +
            `Expected "${predictedName}" in ${outputDir}; directory contains: ${listing.join(', ') || '(empty)'}.`,
        );
      }
      entries.push({ target, path: join(outputDir, match) });
    }
  }

  return entries;
}

function findFallbackMatch(
  listing: readonly string[],
  target: Target,
  predicted: string,
): string | undefined {
  // Try exact first (handles case-sensitivity quirks).
  if (listing.includes(predicted)) return predicted;
  // Try case-insensitive — Windows filesystems.
  const lower = predicted.toLowerCase();
  const ci = listing.find((f) => f.toLowerCase() === lower);
  if (ci !== undefined) return ci;
  // Last resort: any file containing BOTH the os and arch tokens. Avoids the
  // fragility of the exact predicted name when pkg's heuristic drifts.
  const needle = `${target.os}-${target.arch}`;
  return listing.find((f) => f.toLowerCase().includes(needle.toLowerCase()));
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
