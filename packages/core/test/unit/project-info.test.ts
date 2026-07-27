import { test } from 'node:test';
import { strictEqual, rejects } from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readProjectInfo, tokensForTarget } from '../../src/project-info.ts';
import { ValidationError } from '../../src/errors.ts';
import type { Target } from '../../src/targets.ts';

async function withProject<T>(
  pkg: Record<string, unknown> | string,
  fn: (dir: string) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'pkgaction-project-'));
  try {
    await writeFile(
      join(dir, 'package.json'),
      typeof pkg === 'string' ? pkg : JSON.stringify(pkg, null, 2),
    );
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('readProjectInfo parses name and version', async () => {
  await withProject({ name: 'my-app', version: '1.2.3' }, async (dir) => {
    const info = await readProjectInfo(dir);
    strictEqual(info.name, 'my-app');
    strictEqual(info.version, '1.2.3');
  });
});

test('readProjectInfo throws on missing file', async () => {
  await rejects(readProjectInfo('/does/not/exist'), (err) => err instanceof ValidationError);
});

test('readProjectInfo throws on invalid JSON', async () => {
  await withProject('not valid json', async (dir) => {
    await rejects(readProjectInfo(dir), (err) => err instanceof ValidationError);
  });
});

test('readProjectInfo throws on missing name', async () => {
  await withProject({ version: '1.0.0' }, async (dir) => {
    await rejects(readProjectInfo(dir), (err) => err instanceof ValidationError);
  });
});

test('readProjectInfo throws on missing version', async () => {
  await withProject({ name: 'x' }, async (dir) => {
    await rejects(readProjectInfo(dir), (err) => err instanceof ValidationError);
  });
});

const TARGET: Target = { node: 22, os: 'linux', arch: 'x64' };
const FIXED_DATE = new Date(Date.UTC(2026, 3, 18));

test('tokensForTarget merges project + target + env', () => {
  const tokens = tokensForTarget(
    TARGET,
    { name: 'my-app', version: '1.2.3' },
    {
      GITHUB_SHA: 'abcdef1234567890',
      GITHUB_REF_NAME: 'v1.2.3',
      GITHUB_REF: 'refs/tags/v1.2.3',
    },
    FIXED_DATE,
  );
  strictEqual(tokens.name, 'my-app');
  strictEqual(tokens.version, '1.2.3');
  strictEqual(tokens.target, 'node22-linux-x64');
  strictEqual(tokens.node, 'node22');
  strictEqual(tokens.os, 'linux');
  strictEqual(tokens.arch, 'x64');
  strictEqual(tokens.sha, 'abcdef1');
  strictEqual(tokens.ref, 'v1.2.3');
  strictEqual(tokens.tag, 'v1.2.3');
  strictEqual(tokens.date, '20260418');
});

test('tokensForTarget handles missing GITHUB_* env gracefully', () => {
  const tokens = tokensForTarget(TARGET, { name: 'app', version: '0.1.0' }, {}, FIXED_DATE);
  strictEqual(tokens.sha, '');
  strictEqual(tokens.ref, '');
  strictEqual(tokens.tag, '');
});

test('tokensForTarget leaves tag empty for non-tag refs', () => {
  const tokens = tokensForTarget(
    TARGET,
    { name: 'app', version: '0.1.0' },
    { GITHUB_REF: 'refs/heads/main', GITHUB_REF_NAME: 'main' },
    FIXED_DATE,
  );
  strictEqual(tokens.tag, '');
  strictEqual(tokens.ref, 'main');
});

test('tokensForTarget uses "latest" as node prefix for latest-<os>-<arch>', () => {
  const tokens = tokensForTarget(
    { node: 'latest', os: 'linux', arch: 'x64' },
    { name: 'x', version: '1' },
    {},
    FIXED_DATE,
  );
  strictEqual(tokens.node, 'latest');
  strictEqual(tokens.target, 'latest-linux-x64');
});

// ─── bin entry resolution ─────────────────────────────────────────────────
// Mirrors pkg's own precedence (lib/config.ts resolveInput): string bin wins,
// object bin is keyed by the unscoped package name, else the first value.

test('readProjectInfo resolves a string bin to an absolute entry', async () => {
  await withProject({ name: 'app', version: '1.0.0', bin: 'cli.js' }, async (dir) => {
    const info = await readProjectInfo(dir);
    strictEqual(info.binEntry, join(dir, 'cli.js'));
  });
});

test('readProjectInfo picks the bin entry matching the unscoped package name', async () => {
  await withProject(
    { name: '@scope/app', version: '1.0.0', bin: { other: 'other.js', app: 'right.js' } },
    async (dir) => {
      const info = await readProjectInfo(dir);
      strictEqual(info.binEntry, join(dir, 'right.js'));
    },
  );
});

test('readProjectInfo falls back to the first bin value when no name match', async () => {
  await withProject(
    { name: 'app', version: '1.0.0', bin: { somethingElse: 'first.js', second: 'second.js' } },
    async (dir) => {
      const info = await readProjectInfo(dir);
      strictEqual(info.binEntry, join(dir, 'first.js'));
    },
  );
});

test('readProjectInfo reports no bin entry when bin is absent', async () => {
  await withProject({ name: 'app', version: '1.0.0' }, async (dir) => {
    const info = await readProjectInfo(dir);
    strictEqual(info.binEntry, undefined);
  });
});

test('readProjectInfo ignores a non-string, non-object bin', async () => {
  await withProject({ name: 'app', version: '1.0.0', bin: 42 }, async (dir) => {
    const info = await readProjectInfo(dir);
    strictEqual(info.binEntry, undefined);
  });
});
