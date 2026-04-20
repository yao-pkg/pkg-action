import { test } from 'node:test';
import { ok, strictEqual } from 'node:assert/strict';
import { buildReleaseBody, humanSize, shortenDigest } from '../../src/release-body.ts';
import type { SummaryRow } from '../../src/summary.ts';

const row = (overrides: Partial<SummaryRow> = {}): SummaryRow => ({
  target: 'node22-linux-x64',
  filename: '/tmp/out/tiny-1.0-linux-x64.tar.gz',
  sizeBytes: 3 * 1024 * 1024,
  primaryDigest: { algo: 'sha256', value: 'a'.repeat(64) },
  ...overrides,
});

test('humanSize: picks the right unit with decimals', () => {
  strictEqual(humanSize(512), '512 B');
  strictEqual(humanSize(2048), '2.00 kB');
  strictEqual(humanSize(5 * 1024 * 1024), '5.00 MB');
});

test('humanSize: guards against NaN / negative', () => {
  strictEqual(humanSize(NaN), '—');
  strictEqual(humanSize(-1), '—');
});

test('shortenDigest: sha256 passes through unchanged', () => {
  const sha = 'a'.repeat(64);
  strictEqual(shortenDigest(sha), sha);
});

test('shortenDigest: sha512 gets head…tail trim', () => {
  const sha = 'abcdefgh' + 'z'.repeat(100) + 'wxyz';
  const trimmed = shortenDigest(sha);
  ok(trimmed.startsWith('abcdefgh…'));
  ok(trimmed.endsWith('wxyz'));
});

test('buildReleaseBody: empty rows + no user body → just the trailer', () => {
  const body = buildReleaseBody({ userBody: undefined, rows: [], actionVersion: '1.0.0' });
  ok(body.includes('yao-pkg/pkg-action@1.0.0'));
  ok(!body.includes('| Target |'));
});

test('buildReleaseBody: user body preserved + Binaries section appended', () => {
  const body = buildReleaseBody({
    userBody: '## Highlights\n\nShiny new release.',
    rows: [row()],
    actionVersion: '1.0.0',
  });
  ok(body.startsWith('## Highlights'));
  ok(body.includes('## Binaries'));
  ok(body.includes('| `node22-linux-x64` |'));
  ok(body.includes('tiny-1.0-linux-x64.tar.gz'));
  ok(body.includes('sha256:'));
});

test('buildReleaseBody: basename-only filename (no directory leakage)', () => {
  const body = buildReleaseBody({
    userBody: undefined,
    rows: [row({ filename: '/very/long/path/to/tiny-1.0.tar.gz' })],
    actionVersion: '1.0.0',
  });
  ok(body.includes('`tiny-1.0.tar.gz`'));
  ok(!body.includes('/very/long/path/'));
});

test('buildReleaseBody: rows without a digest render —', () => {
  const body = buildReleaseBody({
    userBody: undefined,
    rows: [{ target: 'node22-win-x64', filename: 'app.exe', sizeBytes: 100 }],
    actionVersion: '1.0.0',
  });
  ok(/\| — \|/.test(body));
});
