import { test } from 'node:test';
import { strictEqual, deepStrictEqual, throws, ok } from 'node:assert/strict';
import {
  closestInputName,
  INPUT_SPECS,
  parseInputs,
  PKG_CONFIG_FILENAMES,
  readInputRaw,
  specFor,
} from '../../src/inputs.ts';
import { ValidationError } from '../../src/errors.ts';

function env(...pairs: Array<[string, string]>): Record<string, string> {
  return Object.fromEntries(pairs.map(([k, v]) => [`INPUT_${k.toUpperCase()}`, v]));
}

test('INPUT_SPECS covers every documented category', () => {
  const categories = new Set(INPUT_SPECS.map((s) => s.category));
  for (const c of ['build', 'post-build', 'windows-metadata', 'signing', 'performance']) {
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
});

test('readInputRaw preserves dashes in env keys — matches @actions/core', () => {
  // @actions/core transforms `name` → `INPUT_${name.replace(/ /g, '_').toUpperCase()}`:
  // only spaces are converted to underscores, dashes stay dashes. The literal
  // env key shape on the runner is `INPUT_WINDOWS-PRODUCT-NAME`, NOT
  // `INPUT_WINDOWS_PRODUCT_NAME`.
  strictEqual(
    readInputRaw({ 'INPUT_WINDOWS-PRODUCT-NAME': 'PkgActionTest' }, 'windows-product-name'),
    'PkgActionTest',
  );
  // And it does NOT match the wrong-shape underscore variant — so the env
  // coming back from CI actually lands on our parser.
  strictEqual(
    readInputRaw({ INPUT_WINDOWS_PRODUCT_NAME: 'wrong' }, 'windows-product-name'),
    undefined,
  );
});

test('parseInputs with no env uses defaults', () => {
  const inputs = parseInputs({ env: {} });
  strictEqual(inputs.build.targets, 'host');
  strictEqual(inputs.build.config, undefined);
  strictEqual(inputs.build.configInline, undefined);
  strictEqual(inputs.build.entry, undefined);
  strictEqual(inputs.build.pkgVersion, '~6.21.0');
  strictEqual(inputs.build.pkgPath, undefined);

  strictEqual(inputs.postBuild.compress, 'none');
  strictEqual(inputs.postBuild.strip, false);
  strictEqual(inputs.postBuild.filename, '{name}-{version}-{os}-{arch}');
  deepStrictEqual(inputs.postBuild.checksum, ['sha256']);

  strictEqual(inputs.performance.cache, true);
  strictEqual(inputs.performance.stepSummary, true);
});

test('parseInputs threads pkg-version + pkg-path through', () => {
  const inputs = parseInputs({
    env: env(['pkg-version', '~6.99.0'], ['pkg-path', '/opt/pkg/bin/pkg']),
  });
  strictEqual(inputs.build.pkgVersion, '~6.99.0');
  strictEqual(inputs.build.pkgPath, '/opt/pkg/bin/pkg');
});

test('parseInputs accepts the npm specifier forms a caller can reasonably write', () => {
  for (const spec of ['~6.21.0', '6.21.0', 'latest', '^6.19', '>=6.19.0 <7', '6.x || 7.x', '*']) {
    strictEqual(parseInputs({ env: env(['pkg-version', spec]) }).build.pkgVersion, spec);
  }
});

// Until v1 this shape check lived in the composite's install step, where it
// stopped a crafted specifier from being interpolated into bash. The install
// now runs through @actions/exec with the specifier in one argv element, so the
// check survives for the other half of its job: failing a typo fast, naming the
// input, instead of surfacing as an opaque npm error.
test('parseInputs rejects a pkg-version that is not a version specifier', () => {
  for (const bad of ['6.21.0; rm -rf /', '$(id)', '`id`', '6.21.0 && echo pwned', 'a/b']) {
    throws(
      () => parseInputs({ env: env(['pkg-version', bad]) }),
      (err: unknown) =>
        err instanceof ValidationError && /not a valid npm version specifier/.test(err.message),
      `accepted ${bad}`,
    );
  }
});

test('parseInputs parses a realistic build config', () => {
  const inputs = parseInputs({
    env: env(
      ['targets', 'node22-linux-x64,node22-macos-arm64'],
      ['config', '.pkgrc.json'],
      ['entry', 'src/main.js'],
      ['compress', 'tar.gz'],
      ['checksum', 'sha256,sha512'],
      ['strip', 'true'],
    ),
  });
  ok(Array.isArray(inputs.build.targets));
  strictEqual((inputs.build.targets as never[]).length, 2);
  strictEqual(inputs.build.config, '.pkgrc.json');
  strictEqual(inputs.build.entry, 'src/main.js');
  strictEqual(inputs.postBuild.compress, 'tar.gz');
  deepStrictEqual(inputs.postBuild.checksum, ['sha256', 'sha512']);
  strictEqual(inputs.postBuild.strip, true);
});

test('parseInputs accepts config-inline with valid JSON object', () => {
  const inputs = parseInputs({
    env: env(['config-inline', '{"bin":"src/main.js","mode":"sea"}']),
  });
  strictEqual(inputs.build.config, undefined);
  strictEqual(inputs.build.configInline, '{"bin":"src/main.js","mode":"sea"}');
});

test('parseInputs rejects config + config-inline set together', () => {
  throws(
    () =>
      parseInputs({
        env: env(['config', '.pkgrc.json'], ['config-inline', '{"bin":"x.js"}']),
      }),
    ValidationError,
  );
});

test('parseInputs rejects config-inline with invalid JSON', () => {
  throws(
    () => parseInputs({ env: env(['config-inline', '{not json']) }),
    (err: unknown) => err instanceof ValidationError && /not valid JSON/.test(err.message),
  );
});

test('parseInputs rejects config-inline that is not a JSON object', () => {
  throws(
    () => parseInputs({ env: env(['config-inline', '"bare-string"']) }),
    (err: unknown) => err instanceof ValidationError && /JSON object/.test(err.message),
  );
  throws(
    () => parseInputs({ env: env(['config-inline', '[1,2,3]']) }),
    (err: unknown) => err instanceof ValidationError && /JSON object/.test(err.message),
  );
  throws(
    () => parseInputs({ env: env(['config-inline', 'null']) }),
    (err: unknown) => err instanceof ValidationError && /JSON object/.test(err.message),
  );
});

test('parseInputs flags removed pkg-layer inputs as unknown', () => {
  const unknown: string[] = [];
  parseInputs({
    env: env(
      ['mode', 'sea'],
      ['compress-node', 'Brotli'],
      ['public', 'true'],
      ['no-bytecode', 'true'],
      ['extra-args', '--foo'],
    ),
    onUnknownInput: (n) => unknown.push(n),
  });
  for (const n of ['mode', 'compress-node', 'public', 'no-bytecode', 'extra-args']) {
    ok(unknown.includes(n), `expected "${n}" to be flagged as unknown`);
  }
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
  throws(() => parseInputs({ env: env(['compress', 'rar']) }), ValidationError);
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
      // Real GH runner key shape: dashes preserved, not underscored.
      'INPUT_TYPO-INPUT': 'value',
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

// Guards the removal of the `?? '<literal>'` fallbacks in parseInputs: those
// duplicated the INPUT_SPECS default, so a bump could update one and not the
// other. This asserts the spec is the only place the value lives.
test('parseInputs defaults come from INPUT_SPECS, not a second literal', () => {
  const inputs = parseInputs({ env: {} });
  strictEqual(inputs.build.pkgVersion, specFor('pkg-version')?.default);
  strictEqual(inputs.postBuild.filename, specFor('filename')?.default);
});

test('every spec default is a value parseInputs can actually resolve', () => {
  const inputs = parseInputs({ env: {} });
  ok(inputs.build.pkgVersion !== undefined && inputs.build.pkgVersion !== '');
  ok(inputs.postBuild.filename !== undefined && inputs.postBuild.filename !== '');
});

test('PKG_CONFIG_FILENAMES matches the filenames pkg auto-detects', () => {
  deepStrictEqual(
    [...PKG_CONFIG_FILENAMES],
    ['.pkgrc', '.pkgrc.json', 'pkg.config.js', 'pkg.config.cjs', 'pkg.config.mjs'],
  );
});
