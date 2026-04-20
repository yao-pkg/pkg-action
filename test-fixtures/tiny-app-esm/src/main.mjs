#!/usr/bin/env node

// tiny-app-esm — trivial ESM fixture used by the e2e workflow.
// Uses top-level await to exercise SEA mode's ESM path.

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(await readFile(join(here, '..', 'package.json'), 'utf8'));

process.stdout.write(`tiny-app-esm ${pkg.version}\n`);
