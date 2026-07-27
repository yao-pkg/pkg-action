// scripts/move-major-tag.ts — repoint the floating major tag at the release.
//
// Usage: node --experimental-strip-types scripts/move-major-tag.ts 1.2.3
//
// Every consumer writes `uses: yao-pkg/pkg-action@v1`, so `v1` has to move to
// each v1.x.y or the release reaches nobody. release-it does not do this — it
// owns the immutable `v1.2.3` tag and nothing else — so it runs from the
// `after:release` hook, once the real tag is already pushed.
//
// A prerelease (1.2.3-rc.1) never moves the major tag: `@v1` must not hand
// somebody a release candidate.

import { execFileSync } from 'node:child_process';

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function main(): void {
  const version = process.argv[2];
  if (version === undefined || !/^\d+\.\d+\.\d+/.test(version)) {
    throw new Error(`expected a version argument, got ${String(version)}`);
  }

  if (version.includes('-')) {
    process.stdout.write(`pkg-action move-major-tag — ${version} is a prerelease, leaving tags\n`);
    return;
  }

  const major = `v${version.split('.')[0] ?? ''}`;
  const source = `v${version}`;

  // Fail loudly rather than tagging some other commit: the release tag must
  // already exist, since this runs after release-it pushed it.
  git('rev-parse', '--verify', `${source}^{commit}`);

  git('tag', '-f', '-a', major, '-m', `pkg-action ${major} → ${source}`, `${source}^{commit}`);
  git('push', '--force', 'origin', `refs/tags/${major}`);
  process.stdout.write(`pkg-action move-major-tag — ${major} now points at ${source}\n`);
}

try {
  main();
} catch (err: unknown) {
  process.stderr.write(`pkg-action move-major-tag failed: ${String(err)}\n`);
  process.exit(1);
}
