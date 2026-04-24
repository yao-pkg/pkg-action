import { test } from 'node:test';
import { strictEqual, deepStrictEqual, rejects } from 'node:assert/strict';
import { buildPkgArgs, runPkg, type ExecFn, type ExecResult } from '../../src/pkg-runner.ts';
import type { BuildInputs } from '../../src/inputs.ts';
import { createTestLogger } from '../../src/logger.ts';
import { PkgRunError } from '../../src/errors.ts';

const BASE_BUILD: BuildInputs = {
  config: undefined,
  configInline: undefined,
  entry: undefined,
  targets: 'host',
  pkgVersion: '~6.19.0',
  pkgPath: undefined,
};

const PKG_FLAGS_OWNED_BY_CONFIG = [
  '--sea',
  '--compress',
  '--fallback-to-source',
  '--public',
  '--public-packages',
  '--options',
  '--no-bytecode',
  '--no-dict',
  '--debug',
];

test('buildPkgArgs: minimal invocation', () => {
  const args = buildPkgArgs({
    build: BASE_BUILD,
    targets: [{ node: 22, os: 'linux', arch: 'x64' }],
    outputDir: '/tmp/out',
  });
  deepStrictEqual(args, ['--targets', 'node22-linux-x64', '--out-path', '/tmp/out', '.']);
});

test('buildPkgArgs: never emits pkg-layer flags (those belong in config)', () => {
  const args = buildPkgArgs({
    build: BASE_BUILD,
    targets: [{ node: 22, os: 'linux', arch: 'x64' }],
    outputDir: '/tmp/out',
  });
  for (const flag of PKG_FLAGS_OWNED_BY_CONFIG) {
    strictEqual(args.includes(flag), false, `unexpected flag ${flag}`);
  }
});

test('buildPkgArgs: custom config + entry', () => {
  const args = buildPkgArgs({
    build: { ...BASE_BUILD, config: '.pkgrc.json', entry: 'src/main.js' },
    targets: [{ node: 22, os: 'linux', arch: 'x64' }],
    outputDir: '/tmp/out',
  });
  strictEqual(args.indexOf('--config') + 1, args.indexOf('.pkgrc.json'));
  // Entry is the LAST arg (positional).
  strictEqual(args[args.length - 1], 'src/main.js');
});

test('buildPkgArgs: multi-target list is comma-joined', () => {
  const args = buildPkgArgs({
    build: BASE_BUILD,
    targets: [
      { node: 22, os: 'linux', arch: 'x64' },
      { node: 22, os: 'macos', arch: 'arm64' },
      { node: 22, os: 'win', arch: 'x64' },
    ],
    outputDir: '/tmp/out',
  });
  const i = args.indexOf('--targets');
  strictEqual(args[i + 1], 'node22-linux-x64,node22-macos-arm64,node22-win-x64');
});

test('runPkg passes through a successful exec', async () => {
  const calls: Array<[string, readonly string[]]> = [];
  const exec: ExecFn = async (command, args): Promise<ExecResult> => {
    calls.push([command, args]);
    return { exitCode: 0, stdout: 'ok', stderr: '' };
  };
  const { logger } = createTestLogger();
  const result = await runPkg(
    {
      build: BASE_BUILD,
      targets: [{ node: 22, os: 'linux', arch: 'x64' }],
      outputDir: '/tmp/out',
    },
    { exec, logger, pkgCommand: '/usr/bin/pkg' },
  );
  strictEqual(result.exitCode, 0);
  strictEqual(calls.length, 1);
  strictEqual(calls[0]?.[0], '/usr/bin/pkg');
});

test('runPkg throws PkgRunError on non-zero exit', async () => {
  const exec: ExecFn = async (): Promise<ExecResult> => ({
    exitCode: 2,
    stdout: '',
    stderr: 'nope',
  });
  const { logger } = createTestLogger();
  await rejects(
    runPkg(
      {
        build: BASE_BUILD,
        targets: [{ node: 22, os: 'linux', arch: 'x64' }],
        outputDir: '/tmp/out',
      },
      { exec, logger, pkgCommand: 'pkg' },
    ),
    (err) => err instanceof PkgRunError,
  );
});

test('runPkg wraps spawn errors in PkgRunError with cause', async () => {
  const spawnErr = new Error('ENOENT');
  const exec: ExecFn = async () => {
    throw spawnErr;
  };
  const { logger } = createTestLogger();
  await rejects(
    runPkg(
      {
        build: BASE_BUILD,
        targets: [{ node: 22, os: 'linux', arch: 'x64' }],
        outputDir: '/tmp/out',
      },
      { exec, logger, pkgCommand: 'pkg' },
    ),
    (err) => err instanceof PkgRunError && (err as { cause?: unknown }).cause === spawnErr,
  );
});
