// The generated files are drift-checked in CI by `yarn gen && git diff --exit-code`,
// which proves they match the generator — not that the generator is right. These
// assert the parts with real consequences: the cache-key glob (a missed filename
// silently serves a stale pkg-fetch cache) and the shell-injection guard on the
// install step.

import { test } from 'node:test';
import { ok, match } from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
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

test('install step validates the specifier before installing', async () => {
  const yml = await readGenerated('action.yml');
  match(yml, /if \[\[ ! "\$\{PKG_VERSION\}" =~ \$specifier_re \]\]; then/);
});

/** Every `run: |` block in a generated action.yml, dedented. */
function runBlocks(yml: string): string[] {
  const blocks: string[] = [];
  const lines = yml.split('\n');
  let current: string[] | undefined;
  let indent = 0;
  for (const line of lines) {
    const start = /^(\s*)run: \|/.exec(line);
    if (start?.[1] !== undefined) {
      if (current !== undefined) blocks.push(current.join('\n'));
      current = [];
      indent = start[1].length;
      continue;
    }
    if (current === undefined) continue;
    if (line.trim() !== '' && line.length - line.trimStart().length <= indent) {
      blocks.push(current.join('\n'));
      current = undefined;
      continue;
    }
    current.push(line.slice(indent + 2));
  }
  if (current !== undefined) blocks.push(current.join('\n'));
  return blocks;
}

// `yarn lint` never sees the shell embedded in a YAML string, so a syntax
// error there only surfaces as a red CI job. `[[ ]]` parsing a bare `>` as an
// operator got through exactly this way.
test('generated run blocks are valid bash', async (t) => {
  const yml = await readGenerated('action.yml');
  const blocks = runBlocks(yml);
  ok(blocks.length > 0, 'no run blocks found — the extractor is broken');
  const dir = await mkdtemp(join(tmpdir(), 'pkgaction-shellcheck-'));
  try {
    for (const [i, block] of blocks.entries()) {
      const file = join(dir, `block-${String(i)}.sh`);
      await writeFile(file, block);
      try {
        execFileSync('bash', ['-n', file], { stdio: 'pipe' });
      } catch (err) {
        const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? String(err);
        t.diagnostic(block);
        ok(false, `run block ${String(i)} is not valid bash: ${stderr}`);
      }
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// Actions expands `${{ }}` anywhere inside a run block — shell comments
// included — so a literal one in prose is a template parse error, not a
// comment. This failed CI on every job once; it must fail locally instead.
test('no run block contains a workflow expression', async () => {
  for (const file of ['action.yml', 'packages/build/action.yml']) {
    const lines = (await readGenerated(file)).split('\n');
    let inRun = false;
    let runIndent = 0;
    lines.forEach((line, i) => {
      const runStart = /^(\s*)run: \|/.exec(line);
      if (runStart?.[1] !== undefined) {
        inRun = true;
        runIndent = runStart[1].length;
        return;
      }
      if (!inRun) return;
      const indent = line.length - line.trimStart().length;
      if (line.trim() !== '' && indent <= runIndent) {
        inRun = false;
        return;
      }
      ok(
        !line.includes('${{'),
        `${file}:${String(i + 1)} has a \${{ }} expression inside a run block: ${line.trim()}`,
      );
    });
  }
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
