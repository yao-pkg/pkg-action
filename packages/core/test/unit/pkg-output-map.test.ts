import { test } from 'node:test';
import { strictEqual, deepStrictEqual, rejects, ok } from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mapPkgOutputs, predictOutputNames } from '../../src/pkg-output-map.ts';
import type { Target } from '../../src/targets.ts';
import { PkgRunError } from '../../src/errors.ts';

const LINUX_X64: Target = { node: 22, os: 'linux', arch: 'x64' };
const LINUX_ARM64: Target = { node: 22, os: 'linux', arch: 'arm64' };
const MACOS_X64: Target = { node: 22, os: 'macos', arch: 'x64' };
const MACOS_ARM64: Target = { node: 22, os: 'macos', arch: 'arm64' };
const WIN_X64: Target = { node: 22, os: 'win', arch: 'x64' };
const WIN_ARM64: Target = { node: 22, os: 'win', arch: 'arm64' };
const LINUX_X64_24: Target = { node: 24, os: 'linux', arch: 'x64' };

test('predictOutputNames: single non-Windows target uses base name', () => {
  deepStrictEqual(predictOutputNames([LINUX_X64], 'app'), ['app']);
});

test('predictOutputNames: single Windows target appends .exe', () => {
  deepStrictEqual(predictOutputNames([WIN_X64], 'app'), ['app.exe']);
});

test('predictOutputNames: single Windows target preserves existing .exe', () => {
  deepStrictEqual(predictOutputNames([WIN_X64], 'app.exe'), ['app.exe']);
});

test('predictOutputNames: all parts diverge — full suffix', () => {
  deepStrictEqual(predictOutputNames([LINUX_X64_24, MACOS_ARM64, WIN_X64], 'app'), [
    'app-24-linux-x64',
    'app-22-macos-arm64',
    'app-22-win-x64.exe',
  ]);
});

test('predictOutputNames: only os diverges (same node, same arch)', () => {
  deepStrictEqual(predictOutputNames([LINUX_X64, MACOS_X64, WIN_X64], 'app'), [
    'app-linux',
    'app-macos',
    'app-win.exe',
  ]);
});

test('predictOutputNames: only arch diverges', () => {
  deepStrictEqual(predictOutputNames([LINUX_X64, LINUX_ARM64], 'app'), ['app-x64', 'app-arm64']);
});

test('predictOutputNames: os + arch diverge, same node', () => {
  deepStrictEqual(predictOutputNames([LINUX_X64, MACOS_ARM64, WIN_ARM64], 'app'), [
    'app-linux-x64',
    'app-macos-arm64',
    'app-win-arm64.exe',
  ]);
});

test('predictOutputNames: node + os diverge, same arch', () => {
  deepStrictEqual(predictOutputNames([LINUX_X64, LINUX_X64_24, MACOS_X64], 'app'), [
    'app-22-linux',
    'app-24-linux',
    'app-22-macos',
  ]);
});

test('predictOutputNames: empty input → empty output', () => {
  deepStrictEqual(predictOutputNames([], 'app'), []);
});

async function withOutputDir<T>(
  files: readonly string[],
  fn: (dir: string) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'pkgaction-outmap-'));
  try {
    for (const f of files) {
      await writeFile(join(dir, f), '');
    }
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('mapPkgOutputs: happy path matches predictions', async () => {
  await withOutputDir(['app-linux-x64', 'app-macos-arm64', 'app-win-x64.exe'], async (dir) => {
    const out = await mapPkgOutputs([LINUX_X64, MACOS_ARM64, WIN_X64], 'app', dir);
    strictEqual(out.length, 3);
    strictEqual(out[0]?.path, join(dir, 'app-linux-x64'));
    strictEqual(out[1]?.path, join(dir, 'app-macos-arm64'));
    strictEqual(out[2]?.path, join(dir, 'app-win-x64.exe'));
  });
});

test('mapPkgOutputs: case-insensitive fallback for .EXE', async () => {
  await withOutputDir(['app-linux-x64', 'APP-WIN-X64.EXE'], async (dir) => {
    const out = await mapPkgOutputs([LINUX_X64, WIN_X64], 'app', dir);
    strictEqual(out.length, 2);
    strictEqual(out[1]?.path, join(dir, 'APP-WIN-X64.EXE'));
  });
});

test('mapPkgOutputs: substring fallback when prediction drifts', async () => {
  // pkg produced unexpected names but they contain the os-arch token.
  await withOutputDir(['my-app-linux-x64-binary', 'my-app-macos-arm64-binary'], async (dir) => {
    const out = await mapPkgOutputs([LINUX_X64, MACOS_ARM64], 'my-app', dir);
    strictEqual(out.length, 2);
    ok(out[0]?.path.includes('linux-x64'));
    ok(out[1]?.path.includes('macos-arm64'));
  });
});

test('mapPkgOutputs: throws PkgRunError when an expected file is absent', async () => {
  await withOutputDir(['app-linux-x64'], async (dir) => {
    await rejects(
      mapPkgOutputs([LINUX_X64, MACOS_ARM64], 'app', dir),
      (err) => err instanceof PkgRunError,
    );
  });
});

test('mapPkgOutputs: single-target, bare name', async () => {
  await withOutputDir(['app'], async (dir) => {
    const out = await mapPkgOutputs([LINUX_X64], 'app', dir);
    strictEqual(out.length, 1);
    strictEqual(out[0]?.path, join(dir, 'app'));
  });
});
