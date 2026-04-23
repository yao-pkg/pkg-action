// scripts/check-coverage.ts — enforce a minimum line-coverage ratio.
// Run via: node --experimental-strip-types scripts/check-coverage.ts <lcov> --min <percent>
//
// The lcov file is produced by `yarn test` (node --test-reporter=lcov). We
// sum `LF` (lines found) and `LH` (lines hit) across every SF record and
// fail the process when hit/found falls below the threshold.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

interface Args {
  readonly lcovPath: string;
  readonly minPercent: number;
}

function parseArgs(argv: readonly string[]): Args {
  const [lcov, ...rest] = argv;
  if (lcov === undefined) throw new Error('usage: check-coverage <lcov> --min <percent>');
  const minIdx = rest.indexOf('--min');
  const raw = minIdx >= 0 ? rest[minIdx + 1] : undefined;
  const min = raw !== undefined ? Number(raw) : NaN;
  if (!Number.isFinite(min) || min < 0 || min > 100) {
    throw new Error(`--min must be a number in [0, 100], got ${String(raw)}`);
  }
  return { lcovPath: resolve(lcov), minPercent: min };
}

interface Totals {
  found: number;
  hit: number;
}

function parseLcov(body: string): Totals {
  const totals: Totals = { found: 0, hit: 0 };
  let lineNo = 0;
  for (const line of body.split(/\r?\n/)) {
    lineNo += 1;
    if (line.startsWith('LF:')) totals.found += parseCount(line, lineNo);
    else if (line.startsWith('LH:')) totals.hit += parseCount(line, lineNo);
  }
  return totals;
}

function parseCount(line: string, lineNo: number): number {
  const n = Number(line.slice(3));
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(
      `lcov: malformed ${line.slice(0, 2)} record at line ${String(lineNo)}: ${line}`,
    );
  }
  return n;
}

async function main(): Promise<void> {
  const { lcovPath, minPercent } = parseArgs(process.argv.slice(2));
  const body = await readFile(lcovPath, 'utf8');
  const { found, hit } = parseLcov(body);
  if (found === 0) {
    process.stderr.write(`coverage: no LF records in ${lcovPath}\n`);
    process.exit(1);
  }
  const pct = (hit / found) * 100;
  const rounded = Math.round(pct * 100) / 100;
  process.stdout.write(`coverage: ${String(rounded)}% (${String(hit)}/${String(found)} lines)\n`);
  if (pct + 1e-9 < minPercent) {
    process.stderr.write(`::error::coverage ${String(rounded)}% < ${String(minPercent)}% gate\n`);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`check-coverage: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
