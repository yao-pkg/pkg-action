#!/usr/bin/env node
'use strict';

// tiny-app-cjs — trivial fixture used by the e2e workflow.
// Prints its package version to stdout and exits 0.

const path = require('node:path');
const fs = require('node:fs');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));

process.stdout.write(`tiny-app-cjs ${pkg.version}\n`);
