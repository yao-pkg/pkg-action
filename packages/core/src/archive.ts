// Archive writing. Three paths:
//
//   tar.gz / tar.xz  — shell out to system `tar` (present on every GH-hosted
//                      runner, Windows included since 10 1803)
//   zip              — in-process via `yazl` so we preserve Unix exec bits
//                      regardless of the host OS. System `tar` on Windows
//                      would silently strip mode bits.
//   7z               — shell out to system `7z` (preinstalled on GH-hosted;
//                      self-hosted users must install).
//
// All three paths aim for byte-stable output where reasonable: `yazl` is
// deterministic when mtimes are controlled; `tar` is ordered by filename
// when passed a single input; `7z` output is not guaranteed reproducible
// but the input is tiny enough that run-to-run differences are cosmetic.

import { createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { pipeline } from 'node:stream/promises';
import yazl from 'yazl';
import type { ExecFn } from './pkg-runner.ts';
import { ArchiveError } from './errors.ts';

export type ArchiveFormat = 'tar.gz' | 'tar.xz' | 'zip' | '7z';

export interface ArchiveRequest {
  /** Path to the file being archived (a single pkg binary). */
  readonly inputPath: string;
  /** Absolute path of the archive to write. */
  readonly outputPath: string;
  readonly format: ArchiveFormat;
  /**
   * Optional override for the entry name inside the archive. Defaults to
   * basename(inputPath). Useful when the on-disk name carries a target
   * suffix we want to drop at extraction time.
   */
  readonly entryName?: string;
  /**
   * Unix file mode bits for the archived entry. Defaults to 0o755 for
   * non-Windows binaries so Linux/macOS extractors preserve the exec bit.
   */
  readonly mode?: number;
}

export interface ArchiveDeps {
  readonly exec: ExecFn;
}

/**
 * Create the archive. Returns the output path on success; throws ArchiveError
 * on failure. The caller is responsible for mkdir-ing the parent of outputPath.
 */
export async function archive(req: ArchiveRequest, deps: ArchiveDeps): Promise<string> {
  const entry = req.entryName ?? basename(req.inputPath);
  const mode = req.mode ?? 0o755;

  try {
    await stat(req.inputPath);
  } catch (err) {
    throw new ArchiveError(`Archive input does not exist: ${req.inputPath}`, { cause: err });
  }

  switch (req.format) {
    case 'tar.gz':
      await shellTar(req.inputPath, req.outputPath, 'gz', entry, deps);
      return req.outputPath;
    case 'tar.xz':
      await shellTar(req.inputPath, req.outputPath, 'xz', entry, deps);
      return req.outputPath;
    case 'zip':
      await writeZip(req.inputPath, req.outputPath, entry, mode);
      return req.outputPath;
    case '7z':
      await shell7z(req.inputPath, req.outputPath, entry, deps);
      return req.outputPath;
  }
}

/**
 * Pinned mtime used for every byte-stable archive entry — tar headers and
 * the zip writer below both reference this. 2020-01-01T00:00:00Z is far
 * enough in the past that no extractor rejects it and stable across runs.
 */
const REPRO_MTIME = new Date(Date.UTC(2020, 0, 1, 0, 0, 0));
const REPRO_MTIME_TAR = '2020-01-01 00:00:00 UTC';

async function shellTar(
  inputPath: string,
  outputPath: string,
  compression: 'gz' | 'xz',
  entry: string,
  deps: ArchiveDeps,
): Promise<void> {
  // Use GNU/BSD tar's `--transform` on GNU, `-s` on BSD… inconsistent across
  // runners. Simpler: tar from the file's parent dir using its basename, then
  // rename inside the archive only if caller asked for a different entry name.
  // For the common case (entry === basename(inputPath)) we just tar the file
  // as-is. For renames we stage a symlink with the desired name.
  const { dirname } = await import('node:path');
  const { mkdtemp, symlink, utimes, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');

  const compressFlag = compression === 'gz' ? '-z' : '-J';
  let stageDir: string | undefined;
  let workDir = dirname(inputPath);
  let fileName = basename(inputPath);

  if (entry !== basename(inputPath)) {
    stageDir = await mkdtemp(`${tmpdir()}/pkgaction-tar-`);
    const linkPath = `${stageDir}/${entry}`;
    await symlink(inputPath, linkPath);
    workDir = stageDir;
    fileName = entry;
  }

  // Normalize the on-disk mtime in addition to passing --mtime to tar. Both
  // GNU tar and bsdtar honor --mtime, but pinning the source file is the
  // belt-and-suspenders guarantee (bsdtar before libarchive 3.3 used to
  // ignore --mtime in some modes). Also defends zero-byte-delta across OSes
  // when tar's flag handling diverges on edge cases.
  await utimes(inputPath, REPRO_MTIME, REPRO_MTIME);

  // Owner/group zeroing flags diverge:
  //   GNU tar (linux)      → --owner=0 --group=0
  //   bsdtar (macos, win)  → --uid=0 --gid=0
  // `--numeric-owner` + `--mtime` are common to both. Branching on host
  // platform avoids a `tar --version` probe per archive.
  const ownerFlags =
    process.platform === 'linux' ? ['--owner=0', '--group=0'] : ['--uid=0', '--gid=0'];

  try {
    const result = await deps.exec(
      'tar',
      [
        '-c',
        compressFlag,
        '-f',
        outputPath,
        '--mtime',
        REPRO_MTIME_TAR,
        ...ownerFlags,
        '--numeric-owner',
        '-C',
        workDir,
        fileName,
      ],
      { ignoreReturnCode: true },
    );
    if (result.exitCode !== 0) {
      throw new ArchiveError(
        `tar exited ${String(result.exitCode)} writing ${outputPath}. stderr: ${result.stderr.trim()}`,
      );
    }
  } finally {
    if (stageDir !== undefined) await rm(stageDir, { recursive: true, force: true });
  }
}

async function writeZip(
  inputPath: string,
  outputPath: string,
  entry: string,
  mode: number,
): Promise<void> {
  const zipfile = new yazl.ZipFile();
  zipfile.addFile(inputPath, entry, { mode, mtime: REPRO_MTIME, compress: true });
  zipfile.end();

  try {
    await pipeline(zipfile.outputStream, createWriteStream(outputPath));
  } catch (err) {
    throw new ArchiveError(`Failed to write zip ${outputPath}`, { cause: err });
  }
}

async function shell7z(
  inputPath: string,
  outputPath: string,
  entry: string,
  deps: ArchiveDeps,
): Promise<void> {
  const { dirname } = await import('node:path');
  const { mkdtemp, symlink, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');

  let stageDir: string | undefined;
  let workDir = dirname(inputPath);
  let fileName = basename(inputPath);

  if (entry !== basename(inputPath)) {
    stageDir = await mkdtemp(`${tmpdir()}/pkgaction-7z-`);
    const linkPath = `${stageDir}/${entry}`;
    await symlink(inputPath, linkPath);
    workDir = stageDir;
    fileName = entry;
  }

  try {
    // 7z a <archive> <files...> ; `-bb0` keeps stderr quiet on success.
    const result = await deps.exec('7z', ['a', '-bb0', outputPath, fileName], {
      cwd: workDir,
      ignoreReturnCode: true,
    });
    if (result.exitCode !== 0) {
      throw new ArchiveError(
        `7z exited ${String(result.exitCode)} writing ${outputPath}. stderr: ${result.stderr.trim()}`,
      );
    }
  } finally {
    if (stageDir !== undefined) await rm(stageDir, { recursive: true, force: true });
  }
}
