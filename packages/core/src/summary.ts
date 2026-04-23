// GitHub Actions step summary — a markdown table of binaries + sizes +
// checksums produced by the build. Writes to $GITHUB_STEP_SUMMARY when set;
// otherwise returns the rendered markdown so callers can log it.
//
// No external deps — pure markdown generation.

import { appendFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { ChecksumAlgorithm } from './checksum.ts';

export interface SummaryRow {
  readonly target: string;
  readonly filename: string;
  /** Byte size of the final (archived) artifact. */
  readonly sizeBytes: number;
  /** Primary algorithm shown in the table (usually sha256). Others are footnoted. */
  readonly primaryDigest?: { algo: ChecksumAlgorithm; value: string };
  /** Milliseconds for the pkg + finalize pipeline, if the caller measured. */
  readonly durationMs?: number;
  /** True when the binary was signed in this run. Renders a ✓ in the Signed column. */
  readonly signed?: boolean;
}

export interface SummaryOptions {
  readonly title?: string;
  readonly pkgVersion?: string;
  readonly actionVersion?: string;
}

/**
 * Render the summary as markdown. Returned string ends with a trailing newline.
 */
export function renderSummary(rows: readonly SummaryRow[], opts: SummaryOptions = {}): string {
  const parts: string[] = [];
  parts.push(`## ${opts.title ?? 'pkg-action build summary'}`);
  parts.push('');

  const meta: string[] = [];
  if (opts.actionVersion !== undefined) meta.push(`**action:** \`${opts.actionVersion}\``);
  if (opts.pkgVersion !== undefined) meta.push(`**pkg:** \`${opts.pkgVersion}\``);
  if (meta.length > 0) {
    parts.push(meta.join(' · '));
    parts.push('');
  }

  if (rows.length === 0) {
    parts.push('_No binaries produced._');
    parts.push('');
    return parts.join('\n');
  }

  const hasDuration = rows.some((r) => r.durationMs !== undefined);
  const hasDigest = rows.some((r) => r.primaryDigest !== undefined);
  const hasSigned = rows.some((r) => r.signed === true);

  const header = ['Target', 'Filename', 'Size'];
  if (hasDigest) header.push('SHA');
  if (hasSigned) header.push('Signed');
  if (hasDuration) header.push('Time');
  const sep = header.map(() => '---');

  parts.push(`| ${header.join(' | ')} |`);
  parts.push(`| ${sep.join(' | ')} |`);

  for (const row of rows) {
    const cells: string[] = [
      `\`${row.target}\``,
      `\`${basename(row.filename)}\``,
      formatBytes(row.sizeBytes),
    ];
    if (hasDigest) {
      if (row.primaryDigest !== undefined) {
        cells.push(`\`${row.primaryDigest.algo}:${row.primaryDigest.value.slice(0, 12)}…\``);
      } else {
        cells.push('—');
      }
    }
    if (hasSigned) cells.push(row.signed === true ? '✓' : '—');
    if (hasDuration) {
      cells.push(row.durationMs !== undefined ? formatDuration(row.durationMs) : '—');
    }
    parts.push(`| ${cells.join(' | ')} |`);
  }
  parts.push('');
  return parts.join('\n');
}

/**
 * Append the rendered summary to $GITHUB_STEP_SUMMARY. Returns true when the
 * env is present (i.e. we're running inside a GitHub Actions job), false when
 * no-op (running locally).
 */
export async function writeSummary(
  rows: readonly SummaryRow[],
  opts: SummaryOptions = {},
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<boolean> {
  const path = env['GITHUB_STEP_SUMMARY'];
  if (path === undefined || path === '') return false;
  const markdown = renderSummary(rows, opts);
  await appendFile(path, markdown);
  return true;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KiB', 'MiB', 'GiB', 'TiB'];
  let v = bytes;
  let i = -1;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${m}m ${rem.toFixed(0)}s`;
}
