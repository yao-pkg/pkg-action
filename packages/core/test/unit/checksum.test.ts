import { test } from 'node:test';
import { strictEqual, ok, rejects } from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CHECKSUM_ALGORITHMS,
  computeAllChecksums,
  computeChecksum,
  isChecksumAlgorithm,
  writeShasumsFile,
  writeSidecar,
} from '../../src/checksum.ts';
import { ChecksumError } from '../../src/errors.ts';

async function withTempFile<T>(
  content: string | Uint8Array,
  fn: (path: string) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'pkgaction-checksum-'));
  const path = join(dir, 'payload.bin');
  await writeFile(path, content);
  try {
    return await fn(path);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// Known-vector digests for the empty string, per each algorithm.
// Matches `echo -n '' | openssl dgst -<algo>`.
const EMPTY_VECTORS = {
  sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  sha512:
    'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e',
  md5: 'd41d8cd98f00b204e9800998ecf8427e',
};

// Known-vector digests for "abc".
const ABC_VECTORS = {
  sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  sha512:
    'ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f',
  md5: '900150983cd24fb0d6963f7d28e17f72',
};

test('CHECKSUM_ALGORITHMS lists all supported algos', () => {
  strictEqual(CHECKSUM_ALGORITHMS.length, 3);
});

test('isChecksumAlgorithm accepts supported, rejects others', () => {
  strictEqual(isChecksumAlgorithm('sha256'), true);
  strictEqual(isChecksumAlgorithm('sha512'), true);
  strictEqual(isChecksumAlgorithm('md5'), true);
  strictEqual(isChecksumAlgorithm('sha1'), false);
  strictEqual(isChecksumAlgorithm('blake3'), false);
  strictEqual(isChecksumAlgorithm(''), false);
});

test('computeChecksum matches known vectors for empty file', async () => {
  await withTempFile('', async (path) => {
    strictEqual(await computeChecksum(path, 'sha256'), EMPTY_VECTORS.sha256);
    strictEqual(await computeChecksum(path, 'sha512'), EMPTY_VECTORS.sha512);
    strictEqual(await computeChecksum(path, 'md5'), EMPTY_VECTORS.md5);
  });
});

test('computeChecksum matches known vectors for "abc"', async () => {
  await withTempFile('abc', async (path) => {
    strictEqual(await computeChecksum(path, 'sha256'), ABC_VECTORS.sha256);
    strictEqual(await computeChecksum(path, 'sha512'), ABC_VECTORS.sha512);
    strictEqual(await computeChecksum(path, 'md5'), ABC_VECTORS.md5);
  });
});

test('computeChecksum streams multi-chunk input correctly', async () => {
  // Build a 200 KiB payload — guaranteed to cross the 64 KiB chunk boundary.
  const payload = Buffer.alloc(200 * 1024, 0x41);
  await withTempFile(payload, async (path) => {
    const digest = await computeChecksum(path, 'sha256');
    strictEqual(digest.length, 64);
    // Compute directly in-memory for cross-check.
    const { createHash } = await import('node:crypto');
    const expected = createHash('sha256').update(payload).digest('hex');
    strictEqual(digest, expected);
  });
});

test('computeChecksum wraps fs errors in ChecksumError', async () => {
  await rejects(
    computeChecksum('/does/not/exist/payload.bin', 'sha256'),
    (err) => err instanceof ChecksumError,
  );
});

test('computeAllChecksums returns a record keyed by algo', async () => {
  await withTempFile('abc', async (path) => {
    const all = await computeAllChecksums(path, ['sha256', 'md5']);
    strictEqual(all.sha256, ABC_VECTORS.sha256);
    strictEqual(all.md5, ABC_VECTORS.md5);
  });
});

test('writeShasumsFile produces coreutils-compatible output', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pkgaction-shasum-'));
  try {
    const outPath = join(dir, 'SHASUMS256.txt');
    await writeShasumsFile(outPath, [
      { path: '/tmp/myapp-linux-x64.tar.gz', digest: 'a'.repeat(64) },
      { path: '/tmp/myapp-macos-arm64.zip', digest: 'b'.repeat(64) },
    ]);
    const content = await readFile(outPath, 'utf8');
    // Entries are sorted by basename; linux- < macos-.
    strictEqual(
      content,
      `${'a'.repeat(64)}  myapp-linux-x64.tar.gz\n${'b'.repeat(64)}  myapp-macos-arm64.zip\n`,
    );
    // Double-space between digest and filename — matches coreutils binary-mode marker.
    ok(content.includes('  myapp-linux-x64'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeShasumsFile rejects empty entry list', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pkgaction-shasum-'));
  try {
    await rejects(
      writeShasumsFile(join(dir, 'SHASUMS.txt'), []),
      (err) => err instanceof ChecksumError,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('writeSidecar writes single-entry file next to the binary', async () => {
  await withTempFile('abc', async (path) => {
    const sidecar = await writeSidecar(path, ABC_VECTORS.sha256, 'sha256');
    strictEqual(sidecar, `${path}.sha256`);
    const content = await readFile(sidecar, 'utf8');
    strictEqual(content, `${ABC_VECTORS.sha256}  payload.bin\n`);
  });
});
