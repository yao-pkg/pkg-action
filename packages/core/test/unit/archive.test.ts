// archive.ts tests. Zip is fully exercised here (pure JS via yazl). The tar
// and 7z paths shell out, so they live in integration tests where the host
// actually provides those binaries — here we only test the happy path of the
// yazl-based zip writer.

import { test } from 'node:test';
import { strictEqual, ok, rejects } from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { archive } from '../../src/archive.ts';
import type { ExecFn, ExecResult } from '../../src/pkg-runner.ts';
import { ArchiveError } from '../../src/errors.ts';

// yauzl is NOT a runtime dep; use a minimal zip-header sniff to verify the
// output is a real zip and contains an entry with the expected name.
function parseZipCentralDirEntryNames(buf: Buffer): string[] {
  const names: string[] = [];
  // Central directory file header signature: 0x02014b50
  const sig = Buffer.from([0x50, 0x4b, 0x01, 0x02]);
  let idx = 0;
  while ((idx = buf.indexOf(sig, idx)) !== -1) {
    // name length at offset 28 (LE uint16) from sig start
    const nameLen = buf.readUInt16LE(idx + 28);
    const extraLen = buf.readUInt16LE(idx + 30);
    const commentLen = buf.readUInt16LE(idx + 32);
    const name = buf.subarray(idx + 46, idx + 46 + nameLen).toString('utf8');
    names.push(name);
    idx += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

const NOOP_EXEC: ExecFn = async (): Promise<ExecResult> => ({
  exitCode: 0,
  stdout: '',
  stderr: '',
});

async function withTempPair<T>(
  fn: (inputPath: string, outputPath: string, dir: string) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'pkgaction-archive-'));
  try {
    const inputPath = join(dir, 'app');
    await writeFile(inputPath, Buffer.from('hello world binary'));
    const outputPath = join(dir, 'out.zip');
    return await fn(inputPath, outputPath, dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('archive: zip writes a valid zip with the expected entry', async () => {
  await withTempPair(async (inputPath, outputPath) => {
    const result = await archive({ inputPath, outputPath, format: 'zip' }, { exec: NOOP_EXEC });
    strictEqual(result, outputPath);
    const buf = await readFile(outputPath);
    // ZIP local file header signature at offset 0.
    strictEqual(buf.readUInt32LE(0), 0x04034b50);
    const names = parseZipCentralDirEntryNames(buf);
    ok(names.includes('app'));
  });
});

test('archive: zip honors entryName override', async () => {
  await withTempPair(async (inputPath, outputPath) => {
    await archive(
      { inputPath, outputPath, format: 'zip', entryName: 'renamed.bin' },
      { exec: NOOP_EXEC },
    );
    const buf = await readFile(outputPath);
    const names = parseZipCentralDirEntryNames(buf);
    ok(names.includes('renamed.bin'));
    ok(!names.includes('app'));
  });
});

test('archive: zip produces a non-empty file', async () => {
  await withTempPair(async (inputPath, outputPath) => {
    await archive({ inputPath, outputPath, format: 'zip' }, { exec: NOOP_EXEC });
    const st = await stat(outputPath);
    ok(st.size > 0);
  });
});

test('archive: throws ArchiveError for missing input', async () => {
  await rejects(
    archive(
      { inputPath: '/does/not/exist', outputPath: '/tmp/out.zip', format: 'zip' },
      { exec: NOOP_EXEC },
    ),
    (err) => err instanceof ArchiveError,
  );
});

test('archive: tar.gz shells out with correct args', async () => {
  await withTempPair(async (inputPath, outputPath) => {
    const calls: Array<{ cmd: string; args: readonly string[] }> = [];
    const exec: ExecFn = async (cmd, args) => {
      calls.push({ cmd, args });
      return { exitCode: 0, stdout: '', stderr: '' };
    };
    const tarOut = outputPath.replace('.zip', '.tar.gz');
    await archive({ inputPath, outputPath: tarOut, format: 'tar.gz' }, { exec });
    strictEqual(calls.length, 1);
    strictEqual(calls[0]?.cmd, 'tar');
    ok(calls[0]?.args.includes('-z'));
    ok(calls[0]?.args.includes('-f'));
    ok(calls[0]?.args.includes(tarOut));
    ok(calls[0]?.args.includes('app'));
  });
});

test('archive: tar passes reproducibility flags (--mtime on GNU tar + owner/group zero + --numeric-owner)', async () => {
  await withTempPair(async (inputPath, outputPath) => {
    const calls: Array<{ cmd: string; args: readonly string[] }> = [];
    const exec: ExecFn = async (cmd, args) => {
      calls.push({ cmd, args });
      return { exitCode: 0, stdout: '', stderr: '' };
    };
    const tarOut = outputPath.replace('.zip', '.tar.gz');
    await archive({ inputPath, outputPath: tarOut, format: 'tar.gz' }, { exec });
    const args = calls[0]?.args ?? [];
    ok(args.includes('--numeric-owner'));
    // Flags that diverge between GNU tar and bsdtar:
    //   --owner/--group vs --uid/--gid (both accept --numeric-owner).
    //   --mtime is GNU-only in practice — the macOS runner's bsdtar
    //   rejects it, so we emit it on Linux only.
    if (process.platform === 'linux') {
      ok(args.includes('--owner=0'), 'GNU tar expects --owner=0');
      ok(args.includes('--group=0'), 'GNU tar expects --group=0');
      ok(args.includes('--mtime'), 'GNU tar path should pin --mtime');
      const mtimeIdx = args.indexOf('--mtime');
      strictEqual(args[mtimeIdx + 1], '2020-01-01 00:00:00 UTC');
    } else {
      ok(args.includes('--uid=0'), 'bsdtar expects --uid=0');
      ok(args.includes('--gid=0'), 'bsdtar expects --gid=0');
      ok(!args.includes('--mtime'), 'bsdtar path should omit --mtime');
    }
  });
});

test('archive: tar normalizes the source mtime in addition to --mtime', async () => {
  await withTempPair(async (inputPath, outputPath) => {
    // Pre-bump the input mtime to a recent timestamp; archive() must overwrite it.
    const bumped = new Date(Date.UTC(2025, 5, 15, 12, 0, 0));
    await utimes(inputPath, bumped, bumped);

    const exec: ExecFn = async () => ({ exitCode: 0, stdout: '', stderr: '' });
    const tarOut = outputPath.replace('.zip', '.tar.gz');
    await archive({ inputPath, outputPath: tarOut, format: 'tar.gz' }, { exec });

    const st = await stat(inputPath);
    // mtime must have been pinned to 2020-01-01T00:00:00Z (1577836800 epoch).
    strictEqual(Math.floor(st.mtimeMs / 1000), 1577836800);
  });
});

test('archive: tar.xz shells out with -J', async () => {
  await withTempPair(async (inputPath, outputPath) => {
    const calls: Array<{ cmd: string; args: readonly string[] }> = [];
    const exec: ExecFn = async (cmd, args) => {
      calls.push({ cmd, args });
      return { exitCode: 0, stdout: '', stderr: '' };
    };
    const xzOut = outputPath.replace('.zip', '.tar.xz');
    await archive({ inputPath, outputPath: xzOut, format: 'tar.xz' }, { exec });
    ok(calls[0]?.args.includes('-J'));
  });
});

test('archive: tar wraps non-zero exit in ArchiveError', async () => {
  await withTempPair(async (inputPath, outputPath) => {
    const exec: ExecFn = async () => ({
      exitCode: 1,
      stdout: '',
      stderr: 'permission denied',
    });
    await rejects(
      archive(
        { inputPath, outputPath: outputPath.replace('.zip', '.tar.gz'), format: 'tar.gz' },
        { exec },
      ),
      (err) => err instanceof ArchiveError && err.message.includes('permission denied'),
    );
  });
});

test('archive: 7z shells out with `a -bb0`', async () => {
  await withTempPair(async (inputPath, outputPath) => {
    const calls: Array<{ cmd: string; args: readonly string[] }> = [];
    const exec: ExecFn = async (cmd, args) => {
      calls.push({ cmd, args });
      return { exitCode: 0, stdout: '', stderr: '' };
    };
    const out7z = outputPath.replace('.zip', '.7z');
    await archive({ inputPath, outputPath: out7z, format: '7z' }, { exec });
    strictEqual(calls[0]?.cmd, '7z');
    ok(calls[0]?.args.includes('a'));
    ok(calls[0]?.args.includes('-bb0'));
    ok(calls[0]?.args.includes(out7z));
  });
});
