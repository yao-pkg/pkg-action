// Filesystem helpers that are either (a) security-sensitive (temp creds, zero-fill
// delete) or (b) subtle enough to warrant a unit-tested wrapper (atomic write).

import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { chmod, mkdir, open, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

/**
 * Create an isolated invocation-scoped temp dir under `parent` (typically
 * `$RUNNER_TEMP`). The dir is restricted to the running user on POSIX; on Windows
 * the caller must separately lock it down via icacls (done from windows-sign.ts).
 *
 * Returns the absolute path. The caller records it in `GITHUB_STATE` so the
 * post step can remove it — no globs, so concurrent invocations on a single
 * self-hosted runner don't clobber each other.
 */
export async function createInvocationTemp(parent: string): Promise<string> {
  const id = randomUUID();
  const dir = join(parent, `pkg-action-${id}`);
  await mkdir(dir, { recursive: true, mode: 0o700 });
  // mkdir's mode is honored on POSIX; on Windows it's a no-op. Apply chmod
  // unconditionally — harmless on Windows, belt-and-braces on POSIX for the
  // case where an umask widened the initial creation.
  await chmod(dir, 0o700);
  return dir;
}

/**
 * Filename used by {@link materializePkgConfigInline}. Exposed as a constant so
 * tests can assert the exact placement without re-stringifying it.
 */
export const PKG_CONFIG_INLINE_FILENAME = 'pkg-config.inline.json';

/**
 * Resolve the effective `--config` path pkg will be invoked with.
 *
 * - If `configInline` is defined, write it to
 *   `<invocationDir>/pkg-config.inline.json` and return that path.
 * - Otherwise return `config` unchanged (may be undefined).
 *
 * `parseInputs` guarantees mutual exclusion + JSON-object shape, so this
 * helper does no validation of its own — it is strictly the "bytes to disk"
 * step. Kept here rather than in the orchestrator so it is unit-testable in
 * isolation.
 */
export async function materializePkgConfigInline(opts: {
  readonly config: string | undefined;
  readonly configInline: string | undefined;
  readonly invocationDir: string;
}): Promise<string | undefined> {
  if (opts.configInline === undefined) return opts.config;
  const path = join(opts.invocationDir, PKG_CONFIG_INLINE_FILENAME);
  await writeFile(path, opts.configInline, 'utf8');
  return path;
}

/**
 * Atomic write: write to <path>.tmp-<uuid> then rename over <path>. Avoids
 * the window where a reader sees a half-written file.
 */
export async function atomicWriteFile(path: string, data: string | Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${randomUUID()}`;
  await writeFile(tmp, data);
  await rename(tmp, path);
}

/**
 * Best-effort secure delete: overwrite the file's contents with zeros, flush,
 * then unlink. On journaled/COW filesystems this doesn't guarantee erasure,
 * but it's strictly better than a plain unlink for signing creds and keeps
 * the plaintext out of easy-reach kernel caches.
 */
export async function zeroFillAndRemove(path: string): Promise<void> {
  let size: number;
  try {
    size = (await stat(path)).size;
  } catch {
    // Already gone; nothing to do.
    return;
  }
  if (size > 0) {
    const handle = await open(path, 'r+');
    try {
      const chunkSize = 64 * 1024;
      const zeros = Buffer.alloc(Math.min(chunkSize, size), 0);
      const stream = createWriteStream('', { fd: handle.fd, start: 0, autoClose: false });
      let written = 0;
      const source = Readable.from(
        (async function* () {
          while (written < size) {
            const take = Math.min(zeros.length, size - written);
            yield take === zeros.length ? zeros : zeros.subarray(0, take);
            written += take;
          }
        })(),
      );
      await pipeline(source, stream);
      await handle.sync();
    } finally {
      await handle.close();
    }
  }
  await rm(path, { force: true });
}

/** True if the path exists (any kind). */
export async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
