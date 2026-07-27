// scripts/sync-workspace-versions.ts — copy the root version into every workspace.
//
// Run via `node --experimental-strip-types scripts/sync-workspace-versions.ts`,
// and by release-it's `after:bump` hook so a release never needs a hand edit.
//
// Only the root version is load-bearing: esbuild inlines it as
// __PKG_ACTION_VERSION__ (see scripts/bundle.ts), which is what the action logs
// and puts in the step summary. The workspace packages are `private: true` and
// never published, so their versions are cosmetic — but a package.json claiming
// 0.0.0 inside a v1.2.3 release is a lie that costs someone an afternoon.
//
// Intra-workspace dependencies pin `*` on purpose, so nothing here has to
// rewrite dependency ranges to keep yarn linking locally.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const PACKAGES_DIR = join(REPO_ROOT, 'packages');

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
}

/** Rewrite just the version line, so field order and formatting survive. */
async function setVersion(path: string, version: string): Promise<boolean> {
  const raw = await readFile(path, 'utf8');
  const next = raw.replace(/^(\s*"version":\s*)"[^"]*"/m, `$1"${version}"`);
  if (next === raw) return false;
  await writeFile(path, next);
  return true;
}

async function main(): Promise<void> {
  const rootManifest = join(REPO_ROOT, 'package.json');
  const version = (await readJson(rootManifest))['version'];
  if (typeof version !== 'string' || version === '') {
    throw new Error('root package.json has no version');
  }

  process.stdout.write(`pkg-action sync-workspace-versions — ${version}\n`);

  let changed = 0;
  for (const entry of await readdir(PACKAGES_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifest = join(PACKAGES_DIR, entry.name, 'package.json');
    if (await setVersion(manifest, version)) {
      changed += 1;
      process.stdout.write(`  bumped  packages/${entry.name}/package.json\n`);
    }
  }
  process.stdout.write(
    changed === 0 ? '  nothing to do\n' : `pkg-action sync-workspace-versions — done\n`,
  );
}

main().catch((err: unknown) => {
  process.stderr.write(`pkg-action sync-workspace-versions failed: ${String(err)}\n`);
  process.exit(1);
});
