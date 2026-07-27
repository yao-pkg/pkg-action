// pkg-fetch download cache — key derivation.
//
// The action caches PKG_CACHE_PATH (the prebuilt Node binaries pkg-fetch
// downloads) between runs. This used to be an `actions/cache` step inside a
// composite wrapper, keyed by the workflow-expression `hashFiles(...)`. The
// wrapper is gone — a composite cannot reference its own JS action by relative
// path — so the key is now derived here and the restore/save happen in-process.
//
// The glob list stays derived from PKG_CONFIG_FILENAMES: those drifted apart
// once already, and a glob that misses a real config filename silently serves a
// stale cache.

import { PKG_CONFIG_FILENAMES } from './inputs.ts';

/**
 * Glob patterns whose contents feed the default cache key.
 *
 * Dotfile configs are matched at the project root only (pkg reads `.pkgrc` next
 * to the entry); the rest keep the `**` prefix so a workspace package's config
 * counts too. Same shape the composite passed to `hashFiles()`, so keys carry
 * over from pre-1.0 runs.
 */
export const PKG_CACHE_KEY_GLOBS: readonly string[] = [
  '**/package.json',
  ...PKG_CONFIG_FILENAMES.map((f) => (f.startsWith('.') ? f : `**/${f}`)),
];

export interface PkgCacheKeyParts {
  /** `RUNNER_OS` — `Linux` | `macOS` | `Windows`. */
  readonly os: string;
  /** `RUNNER_ARCH` — `X64` | `ARM64` | …. */
  readonly arch: string;
  /** Hash over PKG_CACHE_KEY_GLOBS. Empty when no file matched. */
  readonly hash: string;
}

/**
 * `derivePkgCacheKey({ os: 'Linux', arch: 'X64', hash: 'ab12' })`
 *   -> `'pkg-fetch-Linux-X64-ab12'`
 *
 * Byte-identical to the `format('pkg-fetch-{0}-{1}-{2}', …)` the composite used.
 */
export function derivePkgCacheKey({ os, arch, hash }: PkgCacheKeyParts): string {
  return `pkg-fetch-${os}-${arch}-${hash}`;
}
