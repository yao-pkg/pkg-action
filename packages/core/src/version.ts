// Action version — single source of truth is the root package.json. Bundled
// builds inline the string via esbuild `define` (see scripts/bundle.ts); dev
// runs (`node --experimental-strip-types`) fall back to reading the file.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

declare const __PKG_ACTION_VERSION__: string | undefined;

function readRootVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    // packages/core/src/version.ts → ../../../package.json
    const pkgPath = resolve(here, '..', '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0-dev';
  } catch {
    return '0.0.0-dev';
  }
}

export const VERSION: string =
  typeof __PKG_ACTION_VERSION__ !== 'undefined' && __PKG_ACTION_VERSION__.length > 0
    ? __PKG_ACTION_VERSION__
    : readRootVersion();
