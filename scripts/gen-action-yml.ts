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

import { INPUT_SPECS, PKG_CONFIG_FILENAMES, specFor, type InputSpec } from '@pkg-action/core';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '../..');

/** `hashFiles` args covering every auto-detected pkg config, derived from the one list. */
const CACHE_CONFIG_GLOBS = PKG_CONFIG_FILENAMES.map((f) =>
  f.startsWith('.') ? `'${f}'` : `'**/${f}'`,
).join(', ');

/** The `pkg-version` default, quoted for prose. Never hardcode it a second time. */
const PKG_VERSION_DEFAULT = specFor('pkg-version')?.default ?? '';

const OUTPUTS = [
  { id: 'binaries', description: 'JSON array of pre-archive binary absolute paths.' },
  { id: 'artifacts', description: 'JSON array of post-archive artifact absolute paths.' },
  { id: 'checksums', description: 'JSON array of absolute paths to SHASUMS*.txt files.' },
  {
    id: 'digests',
    description:
      'JSON object mapping each artifact basename to its {algo: hex} digest map, e.g. {"app-1.0.0-linux-x64.tar.gz": {"sha256": "…"}}.',
  },
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
  // Reject control characters — YAML single-quoted scalars cannot express them
  // and silently emitting an invalid quote-blob would break the action loader.
  // Future descriptions needing newlines must switch to a block scalar.
  // eslint-disable-next-line no-control-regex -- guardrail specifically targets control chars.
  if (/[\x00-\x1F\x7F]/.test(value)) {
    throw new Error(
      `yamlString: control character in ${JSON.stringify(value)} — use a block scalar instead.`,
    );
  }
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
description: 'Build, optionally sign, archive, and checksum Node.js binaries with @yao-pkg/pkg.'
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
        key: \${{ inputs.cache-key || format('pkg-fetch-{0}-{1}-{2}', runner.os, runner.arch, hashFiles('**/package.json', ${CACHE_CONFIG_GLOBS})) }}

    - name: Install @yao-pkg/pkg
      if: \${{ inputs.pkg-path == '' }}
      shell: bash
      env:
        PKG_VERSION: \${{ inputs.pkg-version }}
      run: |
        # Read from env and quoted — never interpolated into this script by the
        # workflow templater, or a crafted specifier would execute right here.
        # The pattern lives in a variable because [[ ]] parses a bare > as an
        # operator before it ever reaches the regex engine.
        specifier_re='^[A-Za-z0-9.*|=<>~^ -]+$'
        if [[ ! "\${PKG_VERSION}" =~ $specifier_re ]]; then
          echo "::error::Input 'pkg-version' is not a valid npm version specifier: \${PKG_VERSION}"
          exit 1
        fi
        npm i -g "@yao-pkg/pkg@\${PKG_VERSION}"

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

// Hooks are pkg-config keys, not action inputs, so they have no INPUT_SPECS
// entry to carry this prose.
const BUILD_HOOKS_SECTION: readonly string[] = [
  '## Build hooks',
  '',
  '@yao-pkg/pkg 6.21.0+ runs three hooks from your pkg config. They have no CLI flags and',
  'no action inputs — set them in the file you point `config` at (or let pkg auto-detect it).',
  `The default \`pkg-version\` (\`${PKG_VERSION_DEFAULT}\`) already includes them; only callers who pinned`,
  'an older pkg need to raise it.',
  '',
  '| Key | Accepts | Runs |',
  '| --- | --- | --- |',
  '| `preBuild` | shell string or function | once, before pkg walks the dependency graph |',
  '| `postBuild` | shell string or function | once per produced binary, after pkg has written it (and, on macOS, ad-hoc signed it) |',
  '| `transform` | function only | per packed file, after path refinement, before bytecode/compression |',
  '',
  'The shell form of `postBuild` gets the absolute output path in `PKG_OUTPUT`; the function',
  'form gets it as its first argument. `transform(file, body)` returns a string or Buffer to',
  'replace the contents, or `undefined` to leave the file alone.',
  '',
  '```js',
  '// pkg.config.mjs',
  "import { join } from 'node:path';",
  '',
  "const SRC_DIR = join(import.meta.dirname, 'src');",
  '',
  'export default {',
  "  targets: ['node22-linux-x64'],",
  "  preBuild: 'npm run build',",
  '  postBuild: (output) => console.log(`built ${output}`),',
  '  transform: (file, body) =>',
  "    file.startsWith(SRC_DIR) && file.endsWith('.js')",
  "      ? body.toString().replaceAll('__VERSION__', () => process.env.GITHUB_SHA ?? 'dev')",
  '      : undefined,',
  '};',
  '```',
  '',
  'Two things that example is careful about: it scopes the rewrite to your own sources (a bare',
  "`.endsWith('.js')` also rewrites every packed `node_modules` file), and it passes a replacer",
  'function so `$&` and `` $` `` in the replacement are not interpreted. Only interpolate values',
  'you trust — a branch name or PR title lands verbatim in the shipped binary.',
  '',
  '> **Hooks are arbitrary code execution.** `preBuild` / `postBuild` shell strings are spawned',
  "> with the runner's full environment, and `transform` is arbitrary JS over every packed file.",
  '> pkg picks a config up from the checked-out tree automatically, so on a workflow that builds',
  '> an untrusted ref (a fork `pull_request`), whoever wrote that ref can run commands in the job —',
  '> alongside any signing certificates and tokens it holds. This capability did not exist before',
  '> pkg 6.21. Build untrusted refs in a job with no secrets, or pin `pkg-version` below 6.21.',
  '',
  '> **Do not move or rename the binary from `postBuild`.** The hook runs inside pkg, before',
  "> the action's windows-metadata, signing, archive and checksum stages. Those stages locate",
  "> outputs by predicting pkg's naming heuristic, then fall back to an exact, case-insensitive,",
  '> and finally `<os>-<arch>` substring match over the output directory — a rename defeats all',
  "> three. Use the action's own archive and checksum inputs instead.",
  '',
  '### Hooks and `config-inline`',
  '',
  '`config-inline` is JSON, so it can only carry the shell-string form of `preBuild` /',
  '`postBuild`. Function hooks and `transform` need a real `pkg.config.{js,cjs,mjs}` file.',
  '',
  'pkg refuses `--config <file>` together with a package.json entry, so whenever `config` points',
  'at a standalone config — or `config-inline` is used — an entry script is required. The action',
  'supplies your package.json `bin` automatically; set the `entry` input if there is no `bin`.',
  '',
];

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

  lines.push(...BUILD_HOOKS_SECTION);

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
