import { test } from 'node:test';
import { strictEqual, ok } from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  atomicWriteFile,
  createInvocationTemp,
  exists,
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
