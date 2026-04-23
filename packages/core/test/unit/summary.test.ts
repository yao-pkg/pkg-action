import { test } from 'node:test';
import { strictEqual, ok } from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderSummary, writeSummary, type SummaryRow } from '../../src/summary.ts';

const ROW_A: SummaryRow = {
  target: 'node22-linux-x64',
  filename: '/tmp/app-1.0.0-linux-x64.tar.gz',
  sizeBytes: 5 * 1024 * 1024 + 123,
  primaryDigest: { algo: 'sha256', value: 'a'.repeat(64) },
  durationMs: 4231,
};

const ROW_B: SummaryRow = {
  target: 'node22-macos-arm64',
  filename: '/tmp/app-1.0.0-macos-arm64.zip',
  sizeBytes: 800,
  primaryDigest: { algo: 'sha256', value: 'b'.repeat(64) },
};

test('renderSummary produces an H2 heading', () => {
  const md = renderSummary([ROW_A]);
  ok(md.startsWith('## pkg-action build summary\n'));
});

test('renderSummary: Signed column only appears when at least one row is signed', () => {
  const unsigned = renderSummary([ROW_A]);
  ok(!unsigned.includes('Signed'));
  const signed = renderSummary([{ ...ROW_A, signed: true }, ROW_B]);
  ok(signed.includes('| Signed |'));
  // Signed row gets ✓, unsigned row gets —.
  ok(/✓/.test(signed));
  ok(/— \|/.test(signed));
});

test('renderSummary respects custom title', () => {
  const md = renderSummary([ROW_A], { title: 'My Build' });
  ok(md.startsWith('## My Build\n'));
});

test('renderSummary emits metadata line when action/pkg versions provided', () => {
  const md = renderSummary([ROW_A], { actionVersion: 'v1.0.0', pkgVersion: '6.16.1' });
  ok(md.includes('**action:** `v1.0.0`'));
  ok(md.includes('**pkg:** `6.16.1`'));
});

test('renderSummary "No binaries produced." message for empty rows', () => {
  const md = renderSummary([]);
  ok(md.includes('_No binaries produced._'));
});

test('renderSummary drops digest column when no row has one', () => {
  const noDigest: SummaryRow = {
    target: 'node22-linux-x64',
    filename: '/tmp/app',
    sizeBytes: 100,
  };
  const md = renderSummary([noDigest]);
  ok(!md.includes('SHA'));
});

test('renderSummary drops duration column when no row has one', () => {
  const noTime: SummaryRow = { ...ROW_B };
  const md = renderSummary([noTime]);
  ok(!md.includes(' Time '));
});

test('renderSummary shows both digest and duration when available', () => {
  const md = renderSummary([ROW_A]);
  ok(md.includes('| Target | Filename | Size | SHA | Time |'));
});

test('renderSummary formats sizes in binary units', () => {
  const md = renderSummary([ROW_A, ROW_B]);
  ok(md.includes('5.00 MiB'));
  ok(md.includes('800 B'));
});

test('renderSummary truncates the digest to the first 12 hex chars', () => {
  const md = renderSummary([ROW_A]);
  ok(md.includes(`sha256:${'a'.repeat(12)}…`));
  ok(!md.includes(`sha256:${'a'.repeat(13)}`));
});

test('renderSummary shows basename, not full path', () => {
  const md = renderSummary([ROW_A]);
  ok(md.includes('app-1.0.0-linux-x64.tar.gz'));
  ok(!md.includes('/tmp/app-1.0.0-linux-x64.tar.gz'));
});

test('renderSummary ends with newline', () => {
  ok(renderSummary([ROW_A]).endsWith('\n'));
});

test('writeSummary appends to $GITHUB_STEP_SUMMARY when set', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pkgaction-summary-'));
  const path = join(dir, 'step-summary.md');
  try {
    const wrote = await writeSummary([ROW_A], {}, { GITHUB_STEP_SUMMARY: path });
    strictEqual(wrote, true);
    const content = await readFile(path, 'utf8');
    ok(content.includes('pkg-action build summary'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeSummary returns false when GITHUB_STEP_SUMMARY unset', async () => {
  const wrote = await writeSummary([ROW_A], {}, {});
  strictEqual(wrote, false);
});

test('writeSummary concatenates across calls (append)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pkgaction-summary-'));
  const path = join(dir, 'step-summary.md');
  try {
    await writeSummary([ROW_A], { title: 'First' }, { GITHUB_STEP_SUMMARY: path });
    await writeSummary([ROW_B], { title: 'Second' }, { GITHUB_STEP_SUMMARY: path });
    const content = await readFile(path, 'utf8');
    ok(content.includes('## First'));
    ok(content.includes('## Second'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
