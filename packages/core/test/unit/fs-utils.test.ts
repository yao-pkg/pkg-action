import { test } from 'node:test';
import { strictEqual, ok } from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  atomicWriteFile,
  createInvocationTemp,
  exists,
  materializePkgConfigInline,
  PKG_CONFIG_INLINE_FILENAME,
  zeroFillAndRemove,
} from '../../src/fs-utils.ts';

async function withTempParent<T>(fn: (parent: string) => Promise<T>): Promise<T> {
  const parent = await mkdtemp(join(tmpdir(), 'pkgaction-test-'));
  try {
    return await fn(parent);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
}

test('createInvocationTemp creates a unique dir under parent', async () => {
  await withTempParent(async (parent) => {
    const a = await createInvocationTemp(parent);
    const b = await createInvocationTemp(parent);
    ok(a !== b, 'two invocations must get distinct paths');
    ok(a.startsWith(parent));
    ok(a.includes('pkg-action-'));
    const statA = await stat(a);
    ok(statA.isDirectory());
    // Permission check is POSIX-only — on Windows the mode bits are meaningless.
    if (process.platform !== 'win32') {
      strictEqual(statA.mode & 0o777, 0o700);
    }
  });
});

test('atomicWriteFile writes the expected content', async () => {
  await withTempParent(async (parent) => {
    const target = join(parent, 'nested', 'out.txt');
    await atomicWriteFile(target, 'hello\nworld');
    strictEqual(await readFile(target, 'utf8'), 'hello\nworld');
  });
});

test('atomicWriteFile leaves no .tmp- sibling on success', async () => {
  await withTempParent(async (parent) => {
    const target = join(parent, 'a.bin');
    await atomicWriteFile(target, new Uint8Array([1, 2, 3]));
    const entries = await readdir(parent);
    strictEqual(entries.filter((e) => e.includes('.tmp-')).length, 0);
    strictEqual(entries.length, 1);
  });
});

test('zeroFillAndRemove removes the file', async () => {
  await withTempParent(async (parent) => {
    const target = join(parent, 'secret.pfx');
    await writeFile(target, 'SUPER-SECRET-CONTENTS');
    strictEqual(await exists(target), true);
    await zeroFillAndRemove(target);
    strictEqual(await exists(target), false);
  });
});

test('zeroFillAndRemove is idempotent on missing file', async () => {
  await withTempParent(async (parent) => {
    const target = join(parent, 'does-not-exist');
    await zeroFillAndRemove(target); // must not throw
    strictEqual(await exists(target), false);
  });
});

test('zeroFillAndRemove handles zero-byte files', async () => {
  await withTempParent(async (parent) => {
    const target = join(parent, 'empty');
    await writeFile(target, '');
    await zeroFillAndRemove(target);
    strictEqual(await exists(target), false);
  });
});

test('exists returns false for missing and true for present', async () => {
  await withTempParent(async (parent) => {
    strictEqual(await exists(join(parent, 'nope')), false);
    await writeFile(join(parent, 'yep'), '');
    strictEqual(await exists(join(parent, 'yep')), true);
  });
});

test('materializePkgConfigInline passes through config when inline is unset', async () => {
  await withTempParent(async (parent) => {
    const out = await materializePkgConfigInline({
      config: '.pkgrc.json',
      configInline: undefined,
      invocationDir: parent,
    });
    strictEqual(out, '.pkgrc.json');
    // Nothing should have been written.
    strictEqual(await exists(join(parent, PKG_CONFIG_INLINE_FILENAME)), false);
  });
});

test('materializePkgConfigInline returns undefined when neither is set', async () => {
  await withTempParent(async (parent) => {
    const out = await materializePkgConfigInline({
      config: undefined,
      configInline: undefined,
      invocationDir: parent,
    });
    strictEqual(out, undefined);
    strictEqual(await exists(join(parent, PKG_CONFIG_INLINE_FILENAME)), false);
  });
});

test('materializePkgConfigInline writes inline JSON and returns its path', async () => {
  await withTempParent(async (parent) => {
    const payload = '{"bin":"src/main.js","sea":true,"compress":"Brotli"}';
    const out = await materializePkgConfigInline({
      config: undefined,
      configInline: payload,
      invocationDir: parent,
    });
    const expected = join(parent, PKG_CONFIG_INLINE_FILENAME);
    strictEqual(out, expected);
    strictEqual(await readFile(expected, 'utf8'), payload);
  });
});

test('materializePkgConfigInline prefers inline over config when inline is set', async () => {
  // parseInputs enforces mutual exclusion, but the helper's contract is
  // "inline wins" — guard against a future caller that accidentally passes
  // both.
  await withTempParent(async (parent) => {
    const out = await materializePkgConfigInline({
      config: '.pkgrc.json',
      configInline: '{"bin":"x.js"}',
      invocationDir: parent,
    });
    strictEqual(out, join(parent, PKG_CONFIG_INLINE_FILENAME));
    strictEqual(await readFile(out as string, 'utf8'), '{"bin":"x.js"}');
  });
});
