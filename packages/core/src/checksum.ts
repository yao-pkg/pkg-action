// Checksum computation + SHASUMS file writer. Uses node:crypto exclusively —
// no shelling out, no external deps. Output format is byte-identical to
// coreutils `sha256sum` / `sha512sum` / `md5sum` so users can verify with
// standard tooling.

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { basename } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { atomicWriteFile } from './fs-utils.ts';
import { ChecksumError } from './errors.ts';

export type ChecksumAlgorithm = 'sha256' | 'sha512' | 'md5';

export const CHECKSUM_ALGORITHMS: readonly ChecksumAlgorithm[] = ['sha256', 'sha512', 'md5'];

export function isChecksumAlgorithm(v: string): v is ChecksumAlgorithm {
  return CHECKSUM_ALGORITHMS.includes(v as ChecksumAlgorithm);
}

/**
 * Compute the hex digest of `filePath` using `algo`. Streams the file in
 * 64-KiB chunks; suitable for multi-GiB binaries.
 */
export async function computeChecksum(filePath: string, algo: ChecksumAlgorithm): Promise<string> {
  const hash = createHash(algo);
  try {
    await pipeline(createReadStream(filePath, { highWaterMark: 64 * 1024 }), hash);
  } catch (err) {
    throw new ChecksumError(`Failed to hash ${filePath} with ${algo}`, { cause: err });
  }
  return hash.digest('hex');
}

export interface ShasumEntry {
  readonly path: string; // used as the `<filename>` in the output; caller passes basename
  readonly digest: string;
}

/**
 * Write a SHASUMS-compatible file. Format matches coreutils:
 *
 *     <digest>  <filename>\n
 *
 * Two spaces between digest and filename (binary-mode marker). The file is
 * written atomically. Entries are sorted by filename for byte-stable output.
 */
export async function writeShasumsFile(
  outPath: string,
  entries: readonly ShasumEntry[],
): Promise<void> {
  if (entries.length === 0) {
    throw new ChecksumError(`Cannot write empty SHASUMS file to ${outPath}`);
  }
  const sorted = [...entries].sort((a, b) => a.path.localeCompare(b.path));
  const body = sorted.map((e) => `${e.digest}  ${basename(e.path)}`).join('\n') + '\n';
  await atomicWriteFile(outPath, body);
}

/**
 * Write a per-file sidecar (e.g. `myapp-1.0.0.tar.gz.sha256`) containing just
 * the digest + filename on one line, matching the output of `sha256sum` on
 * a single file.
 */
export async function writeSidecar(
  binaryPath: string,
  digest: string,
  algo: ChecksumAlgorithm,
): Promise<string> {
  const sidecar = `${binaryPath}.${algo}`;
  const body = `${digest}  ${basename(binaryPath)}\n`;
  await atomicWriteFile(sidecar, body);
  return sidecar;
}

/**
 * Compute every requested digest for a file, returning a map keyed by algo.
 * Reads the file once per algorithm — fine for small artifact counts.
 */
export async function computeAllChecksums(
  filePath: string,
  algos: readonly ChecksumAlgorithm[],
): Promise<Record<ChecksumAlgorithm, string>> {
  const entries = await Promise.all(
    algos.map(async (a) => [a, await computeChecksum(filePath, a)] as const),
  );
  const result: Partial<Record<ChecksumAlgorithm, string>> = {};
  for (const [a, d] of entries) result[a] = d;
  return result as Record<ChecksumAlgorithm, string>;
}
