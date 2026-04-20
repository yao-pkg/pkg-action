// scripts/bundle.ts — esbuild orchestration.
// Run via: node --experimental-strip-types scripts/bundle.ts
//
// Bundles each Node-JS sub-action to a single ESM file under its dist/:
//   packages/build/dist/index.mjs     (+ post.mjs)
//   packages/matrix/dist/index.mjs
//   packages/windows-metadata/dist/index.mjs
//
// The checked-in dist/ files are what `runs.using: node24` executes — no node_modules
// at runtime. A stale dist/ is caught by `git diff --exit-code dist/` in CI.

import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '../..');

interface Target {
  entry: string;
  outfile: string;
}

const TARGETS: readonly Target[] = [
  {
    entry: 'packages/build/src/main.ts',
    outfile: 'packages/build/dist/index.mjs',
  },
  {
    entry: 'packages/build/src/post.ts',
    outfile: 'packages/build/dist/post.mjs',
  },
  {
    entry: 'packages/matrix/src/main.ts',
    outfile: 'packages/matrix/dist/index.mjs',
  },
  {
    entry: 'packages/windows-metadata/src/main.ts',
    outfile: 'packages/windows-metadata/dist/index.mjs',
  },
];

async function bundleOne({ entry, outfile }: Target): Promise<void> {
  const abs = resolve(REPO_ROOT, outfile);
  await mkdir(dirname(abs), { recursive: true });
  await build({
    entryPoints: [resolve(REPO_ROOT, entry)],
    outfile: abs,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node22',
    minifySyntax: true,
    legalComments: 'inline',
    logLevel: 'info',
    // @actions/http-client + tunnel are CJS and do `require('net')` etc. When
    // bundled into an ESM output, esbuild's default shim replaces those with
    // a throwing `__require`. Provide a real createRequire so node builtins
    // resolve at runtime.
    banner: {
      js: [
        "import { createRequire as __pkgActionCreateRequire } from 'node:module';",
        'const require = __pkgActionCreateRequire(import.meta.url);',
      ].join('\n'),
    },
  });
  process.stdout.write(`  bundled  ${entry}  →  ${outfile}\n`);
}

async function main(): Promise<void> {
  process.stdout.write('pkg-action bundle — starting\n');
  for (const target of TARGETS) {
    await bundleOne(target);
  }
  process.stdout.write('pkg-action bundle — done\n');
}

main().catch((err: unknown) => {
  process.stderr.write(`pkg-action bundle failed: ${String(err)}\n`);
  process.exit(1);
});
