// The generated files are drift-checked in CI by `yarn gen && git diff --exit-code`,
// which proves they match the generator — not that the generator is right. These
// assert the parts with real consequences: the cache-key glob (a missed filename
// silently serves a stale pkg-fetch cache) and the shell-injection guard on the
// install step.

import { test } from 'node:test';
import { ok, match } from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PKG_CONFIG_FILENAMES } from '../../src/inputs.ts';

const REPO_ROOT = fileURLToPath(new URL('../../../..', import.meta.url));

const readGenerated = (rel: string): Promise<string> => readFile(join(REPO_ROOT, rel), 'utf8');

test('cache key hashes every pkg config filename pkg auto-detects', async () => {
  const yml = await readGenerated('action.yml');
  const keyLine = yml.split('\n').find((l) => l.includes('hashFiles('));
  ok(keyLine !== undefined, 'no hashFiles line in action.yml');
  for (const name of PKG_CONFIG_FILENAMES) {
    ok(keyLine.includes(`'${name}'`) || keyLine.includes(`'**/${name}'`), `glob misses ${name}`);
  }
});

test('cache key does not hash pkg.config.ts, which pkg never auto-detects', async () => {
  const yml = await readGenerated('action.yml');
  ok(!yml.includes('pkg.config.{js,ts,json}'), 'stale pkg.config glob still present');
});

test('pkg-version reaches the install step via env, never inline interpolation', async () => {
  const yml = await readGenerated('action.yml');
  const install = yml.slice(yml.indexOf('Install @yao-pkg/pkg'));
  ok(
    !install.includes('npm i -g @yao-pkg/pkg@${{'),
    'pkg-version is interpolated straight into the run block — shell injection',
  );
  ok(install.includes('PKG_VERSION: ${{ inputs.pkg-version }}'), 'pkg-version not passed via env');
  ok(
    install.includes('npm i -g "@yao-pkg/pkg@${PKG_VERSION}"'),
    'install does not quote the value',
  );
});

test('install step rejects a specifier containing shell metacharacters', async () => {
  const yml = await readGenerated('action.yml');
  match(yml, /if \[\[ ! "\$\{PKG_VERSION\}" =~ .+ \]\]; then/);
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
