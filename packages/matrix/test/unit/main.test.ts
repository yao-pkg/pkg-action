// Unit tests for packages/matrix/src/main.ts — the matrix sub-action entry.
// Tests use DI-style doubles: each call to `run()` receives a fake deps bag,
// so we never touch @actions/core or real env.

import { test } from 'node:test';
import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert/strict';
import {
  hostFromRunnerLabel,
  parseRunnerOverrides,
  run,
  type MatrixRunDeps,
} from '../../src/main.ts';
import { ValidationError } from '../../../core/src/errors.ts';

interface CapturedCalls {
  readonly outputs: Array<{ name: string; value: string }>;
  readonly warnings: string[];
  readonly infos: string[];
  readonly failures: string[];
}

function makeDeps(
  inputs: Record<string, string>,
  booleans: Record<string, boolean> = {},
): { deps: MatrixRunDeps; calls: CapturedCalls } {
  const calls: CapturedCalls = { outputs: [], warnings: [], infos: [], failures: [] };
  const deps: MatrixRunDeps = {
    getInput: (name) => inputs[name] ?? '',
    getBooleanInput: (name) => booleans[name] ?? false,
    setOutput: (name, value) => calls.outputs.push({ name, value }),
    warning: (m) => calls.warnings.push(m),
    info: (m) => calls.infos.push(m),
    setFailed: (m) => calls.failures.push(m),
  };
  return { deps, calls };
}

// ─── parseRunnerOverrides ────────────────────────────────────────────────

test('parseRunnerOverrides treats blank/empty as an empty map', () => {
  deepStrictEqual(parseRunnerOverrides(''), {});
  deepStrictEqual(parseRunnerOverrides('   '), {});
});

test('parseRunnerOverrides accepts a flat object', () => {
  const overrides = parseRunnerOverrides('{"node22-linux-arm64": "self-hosted-arm"}');
  deepStrictEqual(overrides, { 'node22-linux-arm64': 'self-hosted-arm' });
});

test('parseRunnerOverrides rejects non-JSON', () => {
  throws(() => parseRunnerOverrides('not json'), ValidationError);
});

test('parseRunnerOverrides rejects arrays and primitives', () => {
  throws(() => parseRunnerOverrides('[]'), ValidationError);
  throws(() => parseRunnerOverrides('"string"'), ValidationError);
  throws(() => parseRunnerOverrides('42'), ValidationError);
  throws(() => parseRunnerOverrides('null'), ValidationError);
});

test('parseRunnerOverrides rejects non-string or empty values', () => {
  throws(() => parseRunnerOverrides('{"node22-linux-x64": 1}'), ValidationError);
  throws(() => parseRunnerOverrides('{"node22-linux-x64": ""}'), ValidationError);
});

// ─── hostFromRunnerLabel ─────────────────────────────────────────────────

test('hostFromRunnerLabel maps well-known GH-hosted labels', () => {
  deepStrictEqual(hostFromRunnerLabel('ubuntu-latest', 22), {
    node: 22,
    os: 'linux',
    arch: 'x64',
  });
  deepStrictEqual(hostFromRunnerLabel('ubuntu-24.04-arm', 22), {
    node: 22,
    os: 'linux',
    arch: 'arm64',
  });
  deepStrictEqual(hostFromRunnerLabel('macos-latest', 22), {
    node: 22,
    os: 'macos',
    arch: 'arm64',
  });
  deepStrictEqual(hostFromRunnerLabel('macos-13', 22), {
    node: 22,
    os: 'macos',
    arch: 'x64',
  });
  deepStrictEqual(hostFromRunnerLabel('windows-latest', 22), {
    node: 22,
    os: 'win',
    arch: 'x64',
  });
  deepStrictEqual(hostFromRunnerLabel('windows-11-arm', 22), {
    node: 22,
    os: 'win',
    arch: 'arm64',
  });
});

test('hostFromRunnerLabel returns null for unknown (self-hosted) labels', () => {
  strictEqual(hostFromRunnerLabel('my-bespoke-fleet', 22), null);
  strictEqual(hostFromRunnerLabel('fedora-rawhide', 22), null);
});

// ─── run() — happy path ──────────────────────────────────────────────────

test('run emits a matrix output for the expanded targets', () => {
  const { deps, calls } = makeDeps({
    targets: 'node22-linux-x64,node22-macos-arm64',
  });
  run(deps);
  strictEqual(calls.failures.length, 0);
  strictEqual(calls.outputs.length, 1);
  const out = calls.outputs[0] ?? { name: '', value: '' };
  strictEqual(out.name, 'matrix');
  deepStrictEqual(JSON.parse(out.value), [
    { target: 'node22-linux-x64', runner: 'ubuntu-latest' },
    { target: 'node22-macos-arm64', runner: 'macos-latest' },
  ]);
});

test('run accepts newline-separated targets', () => {
  const { deps, calls } = makeDeps({
    targets: 'node22-linux-x64\nnode22-win-x64',
  });
  run(deps);
  strictEqual(calls.failures.length, 0);
  const parsed = JSON.parse(calls.outputs[0]?.value ?? '[]') as Array<Record<string, string>>;
  strictEqual(parsed.length, 2);
});

// ─── run() — overrides ───────────────────────────────────────────────────

test('run honors per-triple runner-overrides', () => {
  const { deps, calls } = makeDeps({
    targets: 'node22-linux-arm64',
    'runner-overrides': '{"node22-linux-arm64": "self-hosted-arm-01"}',
  });
  run(deps);
  strictEqual(calls.failures.length, 0);
  const parsed = JSON.parse(calls.outputs[0]?.value ?? '[]') as Array<Record<string, string>>;
  strictEqual(parsed[0]?.runner, 'self-hosted-arm-01');
});

test('run honors os-arch shortcut overrides', () => {
  const { deps, calls } = makeDeps({
    targets: 'node22-linux-arm64,node24-linux-arm64',
    'runner-overrides': '{"linux-arm64": "my-arm-fleet"}',
  });
  run(deps);
  strictEqual(calls.failures.length, 0);
  const parsed = JSON.parse(calls.outputs[0]?.value ?? '[]') as Array<Record<string, string>>;
  strictEqual(parsed[0]?.runner, 'my-arm-fleet');
  strictEqual(parsed[1]?.runner, 'my-arm-fleet');
});

// ─── run() — cross-compile warnings ──────────────────────────────────────

test('run does NOT warn when runner is native for target', () => {
  // Default runner for linux-x64 is ubuntu-latest — perfectly native.
  const { deps, calls } = makeDeps({ targets: 'node22-linux-x64' });
  run(deps);
  strictEqual(calls.warnings.length, 0);
});

test('run warns when user override forces a cross-compile', () => {
  // Force linux-arm64 target onto a linux-x64 runner — that triggers the
  // pkg #87/#181 fabricator risk.
  const { deps, calls } = makeDeps({
    targets: 'node22-linux-arm64',
    'runner-overrides': '{"node22-linux-arm64": "ubuntu-latest"}',
  });
  run(deps);
  strictEqual(calls.warnings.length, 1);
  ok((calls.warnings[0] ?? '').includes('#87/#181'));
});

test('run downgrades warnings to info when allow-cross-compile=true', () => {
  const { deps, calls } = makeDeps(
    {
      targets: 'node22-linux-arm64',
      'runner-overrides': '{"node22-linux-arm64": "ubuntu-latest"}',
    },
    { 'allow-cross-compile': true },
  );
  run(deps);
  strictEqual(calls.warnings.length, 0);
  ok(calls.infos.some((m) => m.startsWith('cross-compile (allowed):')));
});

test('run skips cross-compile analysis for unknown runner labels', () => {
  const { deps, calls } = makeDeps({
    targets: 'node22-linux-arm64',
    'runner-overrides': '{"node22-linux-arm64": "my-self-hosted-fleet-01"}',
  });
  run(deps);
  strictEqual(calls.warnings.length, 0);
});

// ─── run() — error surfaces ──────────────────────────────────────────────

test('run fails when targets input is blank', () => {
  const { deps, calls } = makeDeps({ targets: '' });
  run(deps);
  strictEqual(calls.failures.length, 1);
  strictEqual(calls.outputs.length, 0);
});

test('run fails on invalid target triple', () => {
  const { deps, calls } = makeDeps({ targets: 'node22-plan9-x64' });
  run(deps);
  strictEqual(calls.failures.length, 1);
  ok((calls.failures[0] ?? '').includes('ValidationError'));
});

test('run fails on invalid runner-overrides JSON', () => {
  const { deps, calls } = makeDeps({
    targets: 'node22-linux-x64',
    'runner-overrides': 'not-json',
  });
  run(deps);
  strictEqual(calls.failures.length, 1);
  strictEqual(calls.outputs.length, 0);
});

test('run fails when a target has no default runner and no override', () => {
  const { deps, calls } = makeDeps({ targets: 'node22-linux-ppc64' });
  run(deps);
  strictEqual(calls.failures.length, 1);
});
