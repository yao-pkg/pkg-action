import { test } from 'node:test';
import { strictEqual, deepStrictEqual, throws, ok } from 'node:assert/strict';
import {
  crossCompileRisk,
  expandMatrix,
  formatTarget,
  hostTarget,
  parseTarget,
  parseTargetList,
  runnerFor,
} from '../../src/targets.ts';
import { ValidationError } from '../../src/errors.ts';

test('parseTarget accepts a standard triple', () => {
  deepStrictEqual(parseTarget('node22-linux-x64'), {
    node: 22,
    os: 'linux',
    arch: 'x64',
  });
});

test('parseTarget accepts every valid os and arch', () => {
  strictEqual(parseTarget('node24-macos-arm64').os, 'macos');
  strictEqual(parseTarget('node24-win-x64').os, 'win');
  strictEqual(parseTarget('node22-alpine-x64').os, 'alpine');
  strictEqual(parseTarget('node22-linuxstatic-arm64').os, 'linuxstatic');
  strictEqual(parseTarget('node22-linux-armv7').arch, 'armv7');
  strictEqual(parseTarget('node22-linux-ppc64').arch, 'ppc64');
});

test('parseTarget accepts `latest-<os>-<arch>`', () => {
  deepStrictEqual(parseTarget('latest-macos-arm64'), {
    node: 'latest',
    os: 'macos',
    arch: 'arm64',
  });
});

test('parseTarget trims whitespace', () => {
  strictEqual(parseTarget('  node22-linux-x64\t').node, 22);
});

test('parseTarget throws for malformed triples', () => {
  throws(() => parseTarget(''), ValidationError);
  throws(() => parseTarget('linux-x64'), ValidationError);
  throws(() => parseTarget('node22'), ValidationError);
  throws(() => parseTarget('node22-linux'), ValidationError);
  throws(() => parseTarget('node22-linux-x64-extra'), ValidationError);
  throws(() => parseTarget('node-linux-x64'), ValidationError);
});

test('parseTarget rejects Node < 18', () => {
  throws(() => parseTarget('node16-linux-x64'), ValidationError);
  throws(() => parseTarget('node14-linux-x64'), ValidationError);
});

test('parseTarget rejects unknown os', () => {
  throws(() => parseTarget('node22-plan9-x64'), ValidationError);
});

test('parseTarget rejects unknown arch', () => {
  throws(() => parseTarget('node22-linux-riscv'), ValidationError);
});

test('formatTarget round-trips parseTarget', () => {
  const triples = [
    'node22-linux-x64',
    'node24-macos-arm64',
    'latest-win-x64',
    'node22-linuxstatic-armv7',
  ];
  for (const t of triples) {
    strictEqual(formatTarget(parseTarget(t)), t);
  }
});

test('parseTargetList accepts comma and newline separators', () => {
  const targets = parseTargetList('node22-linux-x64, node22-macos-arm64\nnode22-win-x64');
  strictEqual(targets.length, 3);
});

test('parseTargetList deduplicates', () => {
  const targets = parseTargetList('node22-linux-x64,node22-linux-x64, node22-macos-arm64');
  strictEqual(targets.length, 2);
});

test('parseTargetList ignores empty entries', () => {
  const targets = parseTargetList(',\n\nnode22-linux-x64,,  ,');
  strictEqual(targets.length, 1);
});

test('runnerFor resolves every default', () => {
  strictEqual(runnerFor({ node: 22, os: 'linux', arch: 'x64' }), 'ubuntu-latest');
  strictEqual(runnerFor({ node: 22, os: 'linux', arch: 'arm64' }), 'ubuntu-24.04-arm');
  strictEqual(runnerFor({ node: 22, os: 'macos', arch: 'x64' }), 'macos-13');
  strictEqual(runnerFor({ node: 22, os: 'macos', arch: 'arm64' }), 'macos-latest');
  strictEqual(runnerFor({ node: 22, os: 'win', arch: 'x64' }), 'windows-latest');
  strictEqual(runnerFor({ node: 22, os: 'win', arch: 'arm64' }), 'windows-11-arm');
});

test('runnerFor honors per-triple overrides', () => {
  const overrides = { 'node22-linux-arm64': 'my-self-hosted-arm' };
  strictEqual(runnerFor({ node: 22, os: 'linux', arch: 'arm64' }, overrides), 'my-self-hosted-arm');
});

test('runnerFor honors os-arch shortcut overrides', () => {
  const overrides = { 'linux-arm64': 'my-arm-fleet' };
  strictEqual(runnerFor({ node: 22, os: 'linux', arch: 'arm64' }, overrides), 'my-arm-fleet');
});

test('runnerFor throws when no default or override matches', () => {
  throws(() => runnerFor({ node: 22, os: 'linux', arch: 'ppc64' }), ValidationError);
});

test('expandMatrix emits target+runner tuples in input order', () => {
  const targets = parseTargetList('node22-linux-x64,node22-macos-arm64');
  deepStrictEqual(expandMatrix(targets), [
    { target: 'node22-linux-x64', runner: 'ubuntu-latest' },
    { target: 'node22-macos-arm64', runner: 'macos-latest' },
  ]);
});

test('hostTarget maps node/platform/arch correctly', () => {
  const t = hostTarget('linux', 'x64', '22.12.0');
  deepStrictEqual(t, { node: 22, os: 'linux', arch: 'x64' });

  const mac = hostTarget('darwin', 'arm64', '24.1.0');
  deepStrictEqual(mac, { node: 24, os: 'macos', arch: 'arm64' });

  const win = hostTarget('win32', 'x64', '22.0.0');
  deepStrictEqual(win, { node: 22, os: 'win', arch: 'x64' });
});

test('hostTarget throws for unsupported platform', () => {
  throws(() => hostTarget('freebsd' as NodeJS.Platform, 'x64', '22.0.0'), ValidationError);
});

test('crossCompileRisk returns null for same host/target', () => {
  const t = { node: 22, os: 'linux' as const, arch: 'x64' as const };
  strictEqual(crossCompileRisk(t, t), null);
});

test('crossCompileRisk flags Linux → macOS', () => {
  const host = { node: 22, os: 'linux' as const, arch: 'x64' as const };
  const target = { node: 22, os: 'macos' as const, arch: 'arm64' as const };
  const risk = crossCompileRisk(host, target);
  ok(risk !== null);
  ok(risk.includes('#183'));
});

test('crossCompileRisk flags Linux-arm64 from x64 host', () => {
  const host = { node: 22, os: 'linux' as const, arch: 'x64' as const };
  const target = { node: 22, os: 'linux' as const, arch: 'arm64' as const };
  const risk = crossCompileRisk(host, target);
  ok(risk !== null);
  ok(risk.includes('#87/#181'));
});

test('crossCompileRisk flags win-x64 from non-Windows host', () => {
  const host = { node: 22, os: 'linux' as const, arch: 'x64' as const };
  const target = { node: 22, os: 'win' as const, arch: 'x64' as const };
  const risk = crossCompileRisk(host, target);
  ok(risk !== null);
  ok(risk.includes('#87/#181'));
});

test('crossCompileRisk does NOT flag win-x64 built on Windows', () => {
  const host = { node: 22, os: 'win' as const, arch: 'x64' as const };
  const target = { node: 22, os: 'win' as const, arch: 'x64' as const };
  strictEqual(crossCompileRisk(host, target), null);
});

test('crossCompileRisk flags macos-arm64 without macOS host', () => {
  const host = { node: 22, os: 'linux' as const, arch: 'x64' as const };
  const target = { node: 22, os: 'macos' as const, arch: 'arm64' as const };
  const risk = crossCompileRisk(host, target);
  ok(risk !== null);
});
