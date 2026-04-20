// scripts/gen-action-yml.ts — code-generate the three action.yml surfaces
// from the single source of truth in packages/core/src/inputs.ts, plus the
// human-readable docs/inputs.md.
//
// Runs via `node --experimental-strip-types scripts/gen-action-yml.ts`.
//
// Emits:
//   /action.yml                       — top-level composite (marketplace entry)
//   /packages/build/action.yml        — Node24 JS action invoked by the composite
//   /docs/inputs.md                   — reference table
//
// NOT touched here (hand-maintained):
//   /matrix/action.yml                — different input surface
//   /windows-metadata/action.yml      — different input surface
//
// CI gate: `git diff --exit-code` over the generated files catches drift.

import { INPUT_SPECS, type InputSpec } from '@pkg-action/core';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '../..');

const OUTPUTS = [
  { id: 'binaries', description: 'JSON array of pre-archive binary absolute paths.' },
  { id: 'artifacts', description: 'JSON array of post-archive artifact absolute paths.' },
  { id: 'checksums', description: 'JSON array of absolute paths to SHASUMS*.txt files.' },
  { id: 'version', description: 'Resolved package.json version used in filename templates.' },
] as const;

const GENERATED_BANNER = [
  '# GENERATED — do not edit by hand.',
  '# Source of truth: packages/core/src/inputs.ts (INPUT_SPECS).',
  '# Regenerate with: yarn gen',
  '',
].join('\n');

// ─── YAML emission (hand-rolled, no js-yaml dep) ─────────────────────────

function yamlString(value: string): string {
  // Always single-quote, escape embedded single quotes by doubling them.
  return `'${value.replace(/'/g, "''")}'`;
}

function renderInputBlock(spec: InputSpec, indent: string): string {
  const lines: string[] = [];
  lines.push(`${indent}${spec.name}:`);
  lines.push(`${indent}  description: ${yamlString(spec.description)}`);
  if (spec.required === true) lines.push(`${indent}  required: true`);
  if (spec.default !== undefined) {
    lines.push(`${indent}  default: ${yamlString(spec.default)}`);
  }
  if (spec.deprecated !== undefined) {
    lines.push(`${indent}  deprecationMessage: ${yamlString(spec.deprecated)}`);
  }
  return lines.join('\n');
}

function renderInputsSection(indent: string = ''): string {
  return INPUT_SPECS.map((s) => renderInputBlock(s, indent)).join('\n');
}

function renderOutputsSection(indent: string = ''): string {
  return OUTPUTS.map(
    (o) => `${indent}${o.id}:\n${indent}  description: ${yamlString(o.description)}`,
  ).join('\n');
}

// ─── Top-level composite action.yml ───────────────────────────────────────

function renderCompositeActionYml(): string {
  const inputsBlock = renderInputsSection('  ');
  const outputsBlock = INPUT_SPECS.length; // just to use the local binding
  void outputsBlock;

  // Forward every input to the inner ./packages/build step explicitly — composite
  // actions don't support a wildcard pass-through, so codegen does the enumeration.
  const passthrough = INPUT_SPECS.map((s) => `          ${s.name}: \${{ inputs.${s.name} }}`).join(
    '\n',
  );

  const outputsComposite = OUTPUTS.map(
    (o) =>
      `  ${o.id}:\n    description: ${yamlString(o.description)}\n    value: \${{ steps.pkg-action-build.outputs.${o.id} }}`,
  ).join('\n');

  return `${GENERATED_BANNER}name: 'yao-pkg/pkg-action'
description: 'Build, sign, archive, checksum, and publish Node.js binaries with @yao-pkg/pkg.'
author: 'yao-pkg contributors'
branding:
  icon: 'package'
  color: 'blue'

inputs:
${inputsBlock}

outputs:
${outputsComposite}

runs:
  using: 'composite'
  steps:
    - name: Export PKG_CACHE_PATH
      shell: bash
      run: |
        echo "PKG_CACHE_PATH=\${RUNNER_TEMP}/pkg-cache" >> "\${GITHUB_ENV}"

    - name: Cache pkg-fetch Node downloads
      if: \${{ inputs.cache != 'false' }}
      uses: actions/cache@v5
      with:
        path: \${{ runner.temp }}/pkg-cache
        key: \${{ inputs.cache-key || format('pkg-fetch-{0}-{1}-node{2}-{3}', runner.os, runner.arch, inputs.node-version, hashFiles('**/package.json', '.pkgrc*', '**/pkg.config.{js,ts,json}')) }}

    - name: Install @yao-pkg/pkg
      if: \${{ inputs.pkg-path == '' }}
      shell: bash
      run: |
        npm i -g @yao-pkg/pkg@\${{ inputs.pkg-version }}

    - name: Run pkg-action build
      id: pkg-action-build
      uses: ./packages/build
      with:
${passthrough}
`;
}

// ─── packages/build/action.yml (Node24 JS action) ─────────────────────────

function renderBuildActionYml(): string {
  const inputsBlock = renderInputsSection('  ');
  const outputsBlock = renderOutputsSection('  ');
  return `${GENERATED_BANNER}name: 'pkg-action internal: build'
description: 'Internal Node 24 JS action invoked by the top-level pkg-action composite. Not a public API.'
author: 'yao-pkg contributors'

inputs:
${inputsBlock}

outputs:
${outputsBlock}

runs:
  using: 'node24'
  main: 'dist/index.mjs'
  post: 'dist/post.mjs'
`;
}

// ─── docs/inputs.md ───────────────────────────────────────────────────────

function renderInputsDocs(): string {
  const lines: string[] = [];
  lines.push('<!-- GENERATED — do not edit by hand. Source: packages/core/src/inputs.ts. -->');
  lines.push('');
  lines.push('# Inputs');
  lines.push('');
  lines.push('Every `pkg-action` input, grouped by category.');
  lines.push('');

  const categories = [
    'build',
    'post-build',
    'windows-metadata',
    'signing',
    'publishing',
    'performance',
  ] as const;
  const titles: Record<(typeof categories)[number], string> = {
    build: 'Build configuration',
    'post-build': 'Post-build',
    'windows-metadata': 'Windows metadata (resedit)',
    signing: 'Signing & notarization',
    publishing: 'Publishing',
    performance: 'Performance & observability',
  };

  for (const cat of categories) {
    const specs = INPUT_SPECS.filter((s) => s.category === cat);
    if (specs.length === 0) continue;
    lines.push(`## ${titles[cat]}`);
    lines.push('');
    lines.push('| Input | Default | Required | Secret | Description |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const s of specs) {
      const def = s.default !== undefined ? `\`${s.default}\`` : '—';
      const req = s.required === true ? 'yes' : 'no';
      const secret = s.secret === true ? 'yes' : 'no';
      const desc = s.description.replace(/\|/g, '\\|');
      lines.push(`| \`${s.name}\` | ${def} | ${req} | ${secret} | ${desc} |`);
    }
    lines.push('');
  }

  lines.push('## Outputs');
  lines.push('');
  lines.push('| Output | Description |');
  lines.push('| --- | --- |');
  for (const o of OUTPUTS) {
    lines.push(`| \`${o.id}\` | ${o.description} |`);
  }
  lines.push('');
  return lines.join('\n');
}

// ─── main ─────────────────────────────────────────────────────────────────

async function write(path: string, content: string): Promise<void> {
  const abs = resolve(REPO_ROOT, path);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, content);
  process.stdout.write(`  wrote  ${path}  (${String(content.length)} bytes)\n`);
}

async function main(): Promise<void> {
  process.stdout.write('pkg-action gen-action-yml — starting\n');
  await write('action.yml', renderCompositeActionYml());
  await write('packages/build/action.yml', renderBuildActionYml());
  await write('docs/inputs.md', renderInputsDocs());
  process.stdout.write('pkg-action gen-action-yml — done\n');
}

main().catch((err: unknown) => {
  process.stderr.write(`pkg-action gen-action-yml failed: ${String(err)}\n`);
  process.exit(1);
});
