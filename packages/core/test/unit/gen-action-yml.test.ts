// The generated files are drift-checked in CI by `yarn gen && git diff --exit-code`,
// which proves they match the generator — not that the generator is right. These
// assert the parts with real consequences: the cache-key globs (a missed filename
// silently serves a stale pkg-fetch cache) and the shape of every published
// action.yml.

import { test } from 'node:test';
import { ok } from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PKG_CONFIG_FILENAMES } from '../../src/inputs.ts';
import { PKG_CACHE_KEY_GLOBS } from '../../src/pkg-cache.ts';

const REPO_ROOT = fileURLToPath(new URL('../../../..', import.meta.url));

const readGenerated = (rel: string): Promise<string> => readFile(join(REPO_ROOT, rel), 'utf8');

/** Every published action.yml — the root entrypoint plus the two sub-actions. */
const ACTION_YMLS = ['action.yml', 'matrix/action.yml', 'windows-metadata/action.yml'] as const;

test('cache key hashes every pkg config filename pkg auto-detects', () => {
  for (const name of PKG_CONFIG_FILENAMES) {
    ok(
      PKG_CACHE_KEY_GLOBS.includes(name) || PKG_CACHE_KEY_GLOBS.includes(`**/${name}`),
      `glob misses ${name}`,
    );
  }
  ok(PKG_CACHE_KEY_GLOBS.includes('**/package.json'), 'glob misses package.json');
});

test('cache key does not hash pkg.config.ts, which pkg never auto-detects', () => {
  ok(
    !PKG_CACHE_KEY_GLOBS.some((g) => g.includes('.ts')),
    'a glob matches pkg.config.ts, which pkg does not auto-detect',
  );
});

// The bug this guards: a composite step's `uses: ./path` resolves against the
// *consumer's* workspace, not this repo (actions/runner#1348), so it only ever
// works when the workspace happens to be a checkout of pkg-action. It passed
// every in-repo e2e job for exactly that reason. Nothing we publish may
// reference a local action again.
test('no published action.yml references a local action', async () => {
  for (const rel of ACTION_YMLS) {
    for (const [i, line] of (await readGenerated(rel)).split('\n').entries()) {
      ok(
        !/^\s*(-\s*)?uses:\s*\.\//.test(line),
        `${rel}:${String(i + 1)} references a local action: ${line.trim()}`,
      );
    }
  }
});

test('every published action.yml points at a bundle that exists', async () => {
  for (const rel of ACTION_YMLS) {
    const yml = await readGenerated(rel);
    ok(/^\s*using:\s*'node24'$/m.test(yml), `${rel} is not a node24 action`);
    const scripts = [...yml.matchAll(/^\s*(?:main|post):\s*'([^']+)'$/gm)].map((m) => m[1]);
    ok(scripts.length > 0, `${rel} declares neither main nor post`);
    for (const script of scripts) {
      ok(script !== undefined);
      const abs = join(REPO_ROOT, dirname(rel), script);
      const info = await stat(abs).catch(() => undefined);
      ok(info?.isFile() === true, `${rel} points at a missing bundle: ${script}`);
    }
  }
});

// Sub-actions reach their bundle with `../packages/…`, which stays inside the
// fetched checkout only as long as the action directory is one level deep.
test('no action.yml escapes the repository root', async () => {
  for (const rel of ACTION_YMLS) {
    const depth = rel.split('/').length - 1;
    const yml = await readGenerated(rel);
    for (const m of yml.matchAll(/^\s*(?:main|post):\s*'([^']+)'$/gm)) {
      const script = m[1];
      ok(script !== undefined);
      const ups = script.split('/').filter((s) => s === '..').length;
      ok(ups <= depth, `${rel} climbs ${String(ups)} level(s) from depth ${String(depth)}`);
    }
  }
});

test('the repo publishes no action.yml the tests do not know about', async () => {
  const found: string[] = [];
  const walk = async (dir: string, rel: string): Promise<void> => {
    for (const entry of await readdir(join(REPO_ROOT, dir), { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const childRel = rel === '' ? entry.name : `${rel}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(join(dir, entry.name), childRel);
      } else if (entry.name === 'action.yml' || entry.name === 'action.yaml') {
        found.push(childRel);
      }
    }
  };
  await walk('.', '');
  found.sort();
  ok(
    found.join(',') === [...ACTION_YMLS].sort().join(','),
    `action.yml set changed: found ${found.join(', ')}`,
  );
});

test('docs document all three build hooks and the trust boundary', async () => {
  const docs = await readGenerated('docs/inputs.md');
  ok(docs.includes('## Build hooks'));
  for (const hook of ['preBuild', 'postBuild', 'transform']) {
    ok(docs.includes(`\`${hook}\``), `hooks section does not mention ${hook}`);
  }
  ok(docs.includes('arbitrary code execution'), 'no trust-boundary warning');
  ok(docs.includes('untrusted ref'), 'trust warning does not mention untrusted refs');
});

test('docs state the shipped default rather than a hardcoded version', async () => {
  const docs = await readGenerated('docs/inputs.md');
  const { specFor } = await import('../../src/inputs.ts');
  const def = specFor('pkg-version')?.default;
  ok(def !== undefined);
  ok(docs.includes(def), `hooks section does not reference the default ${def}`);
});
