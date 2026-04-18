import { test } from 'node:test';
import { strictEqual, deepStrictEqual, throws, ok } from 'node:assert/strict';
import {
  closestInputName,
  INPUT_SPECS,
  parseInputs,
  readInputRaw,
  specFor,
} from '../../src/inputs.ts';
import { ValidationError } from '../../src/errors.ts';

function env(...pairs: Array<[string, string]>): Record<string, string> {
  return Object.fromEntries(
    pairs.map(([k, v]) => [`INPUT_${k.replace(/-/g, '_').toUpperCase()}`, v]),
  );
}

test('INPUT_SPECS covers every documented category', () => {
  const categories = new Set(INPUT_SPECS.map((s) => s.category));
  for (const c of [
    'build',
    'post-build',
    'windows-metadata',
    'signing',
    'publishing',
    'performance',
  ]) {
    ok(categories.has(c as never), `missing category ${c}`);
  }
});

test('INPUT_SPECS names are kebab-case and unique', () => {
  const seen = new Set<string>();
  for (const s of INPUT_SPECS) {
    ok(/^[a-z]+(-[a-z0-9]+)*$/.test(s.name), `bad name: ${s.name}`);
    ok(!seen.has(s.name), `duplicate: ${s.name}`);
    seen.add(s.name);
  }
});

test('specFor looks up by kebab-case name', () => {
  strictEqual(specFor('targets')?.category, 'build');
  strictEqual(specFor('compress')?.category, 'post-build');
  strictEqual(specFor('does-not-exist'), undefined);
});

test('readInputRaw returns trimmed value or undefined', () => {
  strictEqual(readInputRaw({ INPUT_FOO: '  hello  ' }, 'foo'), 'hello');
  strictEqual(readInputRaw({ INPUT_FOO: '' }, 'foo'), undefined);
  strictEqual(readInputRaw({}, 'foo'), undefined);
  strictEqual(readInputRaw({ INPUT_MULTI_WORD: 'x' }, 'multi-word'), 'x');
});

test('parseInputs with no env uses defaults', () => {
  const inputs = parseInputs({ env: {} });
  strictEqual(inputs.build.targets, 'host');
  strictEqual(inputs.build.mode, 'standard');
  strictEqual(inputs.build.nodeVersion, '22');
  strictEqual(inputs.build.compressNode, 'None');
  strictEqual(inputs.build.fallbackToSource, false);
  strictEqual(inputs.build.public, false);
  strictEqual(inputs.build.pkgVersion, '~6.16.0');

  strictEqual(inputs.postBuild.compress, 'none');
  strictEqual(inputs.postBuild.strip, false);
  strictEqual(inputs.postBuild.filename, '{name}-{version}-{os}-{arch}');
  deepStrictEqual(inputs.postBuild.checksum, ['sha256']);

  strictEqual(inputs.publishing.uploadArtifact, true);
  strictEqual(inputs.publishing.artifactName, '{name}-{version}-{target}');

  strictEqual(inputs.performance.cache, true);
  strictEqual(inputs.performance.stepSummary, true);
  strictEqual(inputs.performance.provenance, false);
});

test('parseInputs parses a realistic build config', () => {
  const inputs = parseInputs({
    env: env(
      ['targets', 'node22-linux-x64,node22-macos-arm64'],
      ['mode', 'sea'],
      ['compress-node', 'Brotli'],
      ['compress', 'tar.gz'],
      ['checksum', 'sha256,sha512'],
      ['strip', 'true'],
      ['fallback-to-source', 'true'],
      ['public', 'true'],
      ['public-packages', 'express,lodash'],
      ['no-dict', '*'],
    ),
  });
  ok(Array.isArray(inputs.build.targets));
  strictEqual((inputs.build.targets as never[]).length, 2);
  strictEqual(inputs.build.mode, 'sea');
  strictEqual(inputs.build.compressNode, 'Brotli');
  strictEqual(inputs.postBuild.compress, 'tar.gz');
  deepStrictEqual(inputs.postBuild.checksum, ['sha256', 'sha512']);
  strictEqual(inputs.postBuild.strip, true);
  strictEqual(inputs.build.fallbackToSource, true);
  strictEqual(inputs.build.public, true);
  deepStrictEqual(inputs.build.publicPackages, ['express', 'lodash']);
  deepStrictEqual(inputs.build.noDict, ['*']);
});

test('parseInputs coerces multiple boolean spellings', () => {
  for (const t of ['true', 'TRUE', '1', 'yes', 'Yes']) {
    strictEqual(parseInputs({ env: env(['strip', t]) }).postBuild.strip, true);
  }
  for (const f of ['false', 'FALSE', '0', 'no', 'No']) {
    strictEqual(parseInputs({ env: env(['strip', f]) }).postBuild.strip, false);
  }
});

test('parseInputs rejects invalid boolean', () => {
  throws(() => parseInputs({ env: env(['strip', 'maybe']) }), ValidationError);
});

test('parseInputs rejects invalid enum value', () => {
  throws(() => parseInputs({ env: env(['mode', 'fast']) }), ValidationError);
  throws(() => parseInputs({ env: env(['compress', 'rar']) }), ValidationError);
  throws(() => parseInputs({ env: env(['compress-node', 'zstd']) }), ValidationError);
});

test('parseInputs checksum accepts "none" and drops to empty list', () => {
  deepStrictEqual(parseInputs({ env: env(['checksum', 'none']) }).postBuild.checksum, []);
});

test('parseInputs checksum rejects mixing none with algos', () => {
  throws(() => parseInputs({ env: env(['checksum', 'none,sha256']) }), ValidationError);
});

test('parseInputs checksum deduplicates', () => {
  deepStrictEqual(parseInputs({ env: env(['checksum', 'sha256,sha256,md5']) }).postBuild.checksum, [
    'sha256',
    'md5',
  ]);
});

test('parseInputs rejects empty-after-split targets', () => {
  throws(() => parseInputs({ env: env(['targets', ', ,']) }), ValidationError);
});

test('parseInputs invokes registerSecret for every secret spec with a value', () => {
  const captured: string[] = [];
  parseInputs({
    env: env(
      ['macos-apple-id', 'apple@user.com'],
      ['macos-app-password', 'notarize-pw'],
      ['windows-sign-password', 'pfx-pw'],
    ),
    registerSecret: (v) => captured.push(v),
  });
  ok(captured.includes('apple@user.com'));
  ok(captured.includes('notarize-pw'));
  ok(captured.includes('pfx-pw'));
});

test('parseInputs does NOT register missing secrets', () => {
  const captured: string[] = [];
  parseInputs({ env: {}, registerSecret: (v) => captured.push(v) });
  strictEqual(captured.length, 0);
});

test('parseInputs calls onUnknownInput for stray INPUT_* envs', () => {
  const unknown: string[] = [];
  parseInputs({
    env: {
      INPUT_TARGETS: 'node22-linux-x64',
      INPUT_TYPO_INPUT: 'value',
      INPUT_COMPREEZ: 'value',
    },
    onUnknownInput: (n) => unknown.push(n),
  });
  ok(unknown.includes('typo-input'));
  ok(unknown.includes('compreez'));
  ok(!unknown.includes('targets'));
});

test('closestInputName suggests known input', () => {
  strictEqual(closestInputName('compreez'), 'compress');
  strictEqual(closestInputName('targts'), 'targets');
  strictEqual(closestInputName('checksom'), 'checksum');
});

test('closestInputName returns null for far-off inputs', () => {
  strictEqual(closestInputName('xxxxxxxxxxxxxxxxxxx'), null);
});
