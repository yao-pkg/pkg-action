// pkg-fetch cache restore/save, split across the action's main and post steps.
//
// Same two-phase shape `actions/cache` itself uses: main restores and records
// what it found, post saves when the key was not already present. State travels
// through `core.saveState`/`getState` because main and post are separate
// processes.

import * as cache from '@actions/cache';
import * as core from '@actions/core';
import { hashFiles } from '@actions/glob';
import { derivePkgCacheKey, PKG_CACHE_KEY_GLOBS, type Logger } from '@pkg-action/core';

const STATE_PATH = 'pkgCachePath';
const STATE_KEY = 'pkgCacheKey';
const STATE_MATCHED = 'pkgCacheMatchedKey';

export interface RestorePkgCacheOptions {
  /** Directory pkg-fetch downloads into — the value of PKG_CACHE_PATH. */
  readonly cachePath: string;
  /** The `cache-key` input; when set it replaces the derived key verbatim. */
  readonly cacheKeyOverride: string | undefined;
  readonly logger: Logger;
}

/**
 * Restores the pkg-fetch cache and records the key for the post step.
 *
 * A cache miss is not an error — pkg-fetch just downloads. Anything thrown by
 * the cache service is downgraded to a warning for the same reason: a broken
 * cache must never fail a build that would otherwise succeed.
 */
export async function restorePkgCache({
  cachePath,
  cacheKeyOverride,
  logger,
}: RestorePkgCacheOptions): Promise<void> {
  let key: string;
  if (cacheKeyOverride !== undefined) {
    key = cacheKeyOverride;
  } else {
    const hash = await hashFiles(PKG_CACHE_KEY_GLOBS.join('\n'));
    key = derivePkgCacheKey({
      os: process.env['RUNNER_OS'] ?? process.platform,
      arch: process.env['RUNNER_ARCH'] ?? process.arch,
      hash,
    });
  }

  core.saveState(STATE_PATH, cachePath);
  core.saveState(STATE_KEY, key);

  try {
    const matched = await cache.restoreCache([cachePath], key);
    if (matched !== undefined) {
      core.saveState(STATE_MATCHED, matched);
      logger.info(`[pkg-action] pkg-fetch cache restored from "${matched}".`);
    } else {
      logger.info(`[pkg-action] pkg-fetch cache miss for "${key}" — will save on completion.`);
    }
  } catch (err) {
    logger.warning(`[pkg-action] pkg-fetch cache restore failed: ${String(err)}`);
  }
}

/**
 * Saves the pkg-fetch cache when main recorded a key that was not already an
 * exact hit. No-op when caching was disabled, since main then saved no state.
 */
export async function savePkgCache(): Promise<void> {
  const cachePath = core.getState(STATE_PATH);
  const key = core.getState(STATE_KEY);
  if (cachePath === '' || key === '') return;

  if (core.getState(STATE_MATCHED) === key) {
    core.debug(`[pkg-action] pkg-fetch cache already holds "${key}" — nothing to save.`);
    return;
  }

  try {
    await cache.saveCache([cachePath], key);
    core.debug(`[pkg-action] pkg-fetch cache saved as "${key}".`);
  } catch (err) {
    // Includes the benign ReserveCacheError raised when a parallel job in the
    // same matrix won the race to this key.
    core.warning(`[pkg-action] pkg-fetch cache save failed: ${String(err)}`);
  }
}
