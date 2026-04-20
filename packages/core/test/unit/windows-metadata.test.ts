import { test } from 'node:test';
import { deepStrictEqual, ok, rejects, strictEqual, throws } from 'node:assert/strict';
import {
  mergeMetadataFile,
  padVersionQuad,
  parseIconSpec,
  parseWindowsMetadataInputs,
  type EnvWindowsMetadata,
  type ReadFileFn,
} from '../../src/windows-metadata.ts';
import { ValidationError } from '../../src/errors.ts';

// Every env is keyed by the GH Actions convention: INPUT_<UPPERCASE_WITH_UNDERSCORES>.
const envOf = (bag: Record<string, string | undefined>): Record<string, string | undefined> => {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(bag)) {
    if (v === undefined) continue;
    out[`INPUT_${k.replace(/-/g, '_').toUpperCase()}`] = v;
  }
  return out;
};

const emptyEnvBag: EnvWindowsMetadata = {
  icons: [],
  productName: undefined,
  productVersion: undefined,
  fileVersion: undefined,
  fileDescription: undefined,
  companyName: undefined,
  legalCopyright: undefined,
  originalFilename: undefined,
  internalName: undefined,
  comments: undefined,
  manifestPath: undefined,
  lang: undefined,
  codepage: undefined,
};

// ─── parseIconSpec ────────────────────────────────────────────────────────

test('parseIconSpec: single bare path → id 1', () => {
  deepStrictEqual(parseIconSpec('/a/icon.ico'), [{ id: 1, path: '/a/icon.ico' }]);
});

test('parseIconSpec: <id>=<path> form', () => {
  deepStrictEqual(parseIconSpec('7=/a/icon.ico'), [{ id: 7, path: '/a/icon.ico' }]);
});

test('parseIconSpec: mixed comma + newline, sorted by id', () => {
  deepStrictEqual(parseIconSpec('3=/a/c.ico,1=/a/a.ico\n2=/a/b.ico'), [
    { id: 1, path: '/a/a.ico' },
    { id: 2, path: '/a/b.ico' },
    { id: 3, path: '/a/c.ico' },
  ]);
});

test('parseIconSpec: last entry wins on duplicate id', () => {
  deepStrictEqual(parseIconSpec('1=/a/first.ico, 1=/a/second.ico'), [
    { id: 1, path: '/a/second.ico' },
  ]);
});

test('parseIconSpec: empty / whitespace input → []', () => {
  deepStrictEqual(parseIconSpec(''), []);
  deepStrictEqual(parseIconSpec('  \n ,  '), []);
});

test('parseIconSpec: rejects id ≤ 0 or > 65535', () => {
  throws(() => parseIconSpec('0=/a/icon.ico'), ValidationError);
  throws(() => parseIconSpec('65536=/a/icon.ico'), ValidationError);
  throws(() => parseIconSpec('-1=/a/icon.ico'), ValidationError);
});

test('parseIconSpec: rejects missing path', () => {
  throws(() => parseIconSpec('7='), ValidationError);
});

// ─── padVersionQuad ───────────────────────────────────────────────────────

test('padVersionQuad: pads single-part version with zeros', () => {
  deepStrictEqual(padVersionQuad('3'), [3, 0, 0, 0]);
});

test('padVersionQuad: pads two-part / three-part versions', () => {
  deepStrictEqual(padVersionQuad('1.2'), [1, 2, 0, 0]);
  deepStrictEqual(padVersionQuad('1.2.3'), [1, 2, 3, 0]);
});

test('padVersionQuad: preserves four-part versions', () => {
  deepStrictEqual(padVersionQuad('1.2.3.4'), [1, 2, 3, 4]);
});

test('padVersionQuad: trims surrounding whitespace', () => {
  deepStrictEqual(padVersionQuad('  1.0 '), [1, 0, 0, 0]);
});

test('padVersionQuad: rejects non-numeric / semver pre-release / empty / extra parts', () => {
  throws(() => padVersionQuad(''), ValidationError);
  throws(() => padVersionQuad('1.0.0-beta'), ValidationError);
  throws(() => padVersionQuad('v1.0'), ValidationError);
  throws(() => padVersionQuad('1.0.0.0.0'), ValidationError);
  throws(() => padVersionQuad('1..0'), ValidationError);
});

test('padVersionQuad: rejects uint16 overflow', () => {
  throws(() => padVersionQuad('65536'), ValidationError);
  throws(() => padVersionQuad('1.99999'), ValidationError);
});

// ─── mergeMetadataFile ────────────────────────────────────────────────────

test('mergeMetadataFile: env-only path returns those values as-is', () => {
  const merged = mergeMetadataFile(
    {
      ...emptyEnvBag,
      productName: 'MyApp',
      fileVersion: '1.2.3',
      lang: 1033,
      codepage: 1200,
    },
    undefined,
  );
  strictEqual(merged.productName, 'MyApp');
  strictEqual(merged.fileVersion, '1.2.3');
  strictEqual(merged.lang, 1033);
  strictEqual(merged.codepage, 1200);
});

test('mergeMetadataFile: file fills gaps left by env', () => {
  const merged = mergeMetadataFile(
    { ...emptyEnvBag, productName: 'EnvWins' },
    { productName: 'FromFile', companyName: 'FileCo', fileVersion: '4.5.6' },
  );
  strictEqual(merged.productName, 'EnvWins'); // env wins on overlap
  strictEqual(merged.companyName, 'FileCo'); // file fills gap
  strictEqual(merged.fileVersion, '4.5.6');
});

test('mergeMetadataFile: icons — env list beats file.icons', () => {
  const merged = mergeMetadataFile(
    { ...emptyEnvBag, icons: [{ id: 1, path: '/env.ico' }] },
    { icons: [{ id: 1, path: '/file.ico' }] },
  );
  deepStrictEqual(merged.icons, [{ id: 1, path: '/env.ico' }]);
});

test('mergeMetadataFile: icons — file fills when env has none', () => {
  const merged = mergeMetadataFile(emptyEnvBag, { icon: '/file.ico' });
  deepStrictEqual(merged.icons, [{ id: 1, path: '/file.ico' }]);
});

test('mergeMetadataFile: file icons[] accepts {id, path} entries', () => {
  const merged = mergeMetadataFile(emptyEnvBag, {
    icons: [
      { id: 2, path: '/two.ico' },
      { id: 1, path: '/one.ico' },
    ],
  });
  deepStrictEqual(merged.icons, [
    { id: 1, path: '/one.ico' },
    { id: 2, path: '/two.ico' },
  ]);
});

test('mergeMetadataFile: file icons[] rejects out-of-range ids', () => {
  throws(
    () =>
      mergeMetadataFile(emptyEnvBag, {
        icons: [{ id: 0, path: '/bad.ico' }],
      }),
    ValidationError,
  );
});

test('mergeMetadataFile: manifest from file when env has none', () => {
  const merged = mergeMetadataFile(emptyEnvBag, { manifest: '/tmp/app.manifest' });
  strictEqual(merged.manifestPath, '/tmp/app.manifest');
});

test('mergeMetadataFile: defaults lang/codepage when neither env nor file supplies them', () => {
  const merged = mergeMetadataFile(emptyEnvBag, undefined);
  strictEqual(merged.lang, 1033);
  strictEqual(merged.codepage, 1200);
});

test('mergeMetadataFile: rejects out-of-range lang/codepage from file', () => {
  throws(() => mergeMetadataFile(emptyEnvBag, { lang: -1 }), ValidationError);
  throws(() => mergeMetadataFile(emptyEnvBag, { codepage: 99999 }), ValidationError);
});

// ─── parseWindowsMetadataInputs ───────────────────────────────────────────

test('parseWindowsMetadataInputs: returns null when nothing is set', async () => {
  const result = await parseWindowsMetadataInputs({ env: {} });
  strictEqual(result, null);
});

test('parseWindowsMetadataInputs: pulls flat env fields', async () => {
  const result = await parseWindowsMetadataInputs({
    env: envOf({
      'windows-product-name': 'Foo',
      'windows-product-version': '1.2.3',
      'windows-company-name': 'Acme',
      'windows-lang': '1041',
      'windows-codepage': '932',
    }),
  });
  ok(result !== null);
  strictEqual(result.productName, 'Foo');
  strictEqual(result.productVersion, '1.2.3');
  strictEqual(result.companyName, 'Acme');
  strictEqual(result.lang, 1041);
  strictEqual(result.codepage, 932);
});

test('parseWindowsMetadataInputs: parses windows-icon into icon specs', async () => {
  const result = await parseWindowsMetadataInputs({
    env: envOf({
      'windows-icon': '1=/a/a.ico\n2=/a/b.ico',
    }),
  });
  ok(result !== null);
  deepStrictEqual(result.icons, [
    { id: 1, path: '/a/a.ico' },
    { id: 2, path: '/a/b.ico' },
  ]);
});

test('parseWindowsMetadataInputs: reads and merges metadata-file JSON', async () => {
  const readFile: ReadFileFn = async (path) => {
    strictEqual(path, '/tmp/meta.json');
    return JSON.stringify({
      productName: 'FromFile',
      companyName: 'FileCo',
      fileDescription: 'FromFileDesc',
    });
  };
  const result = await parseWindowsMetadataInputs({
    env: envOf({
      'windows-metadata-file': '/tmp/meta.json',
      'windows-product-name': 'FromEnv',
    }),
    readFile,
  });
  ok(result !== null);
  strictEqual(result.productName, 'FromEnv');
  strictEqual(result.companyName, 'FileCo');
  strictEqual(result.fileDescription, 'FromFileDesc');
});

test('parseWindowsMetadataInputs: surfaces unreadable metadata-file as ValidationError', async () => {
  const readFile: ReadFileFn = async () => {
    throw new Error('ENOENT');
  };
  await rejects(
    parseWindowsMetadataInputs({
      env: envOf({ 'windows-metadata-file': '/nope.json' }),
      readFile,
    }),
    ValidationError,
  );
});

test('parseWindowsMetadataInputs: surfaces malformed JSON as ValidationError', async () => {
  const readFile: ReadFileFn = async () => 'not-json';
  await rejects(
    parseWindowsMetadataInputs({
      env: envOf({ 'windows-metadata-file': '/meta.json' }),
      readFile,
    }),
    ValidationError,
  );
});

test('parseWindowsMetadataInputs: rejects non-object top-level JSON', async () => {
  const readFile: ReadFileFn = async () => '[1,2,3]';
  await rejects(
    parseWindowsMetadataInputs({
      env: envOf({ 'windows-metadata-file': '/meta.json' }),
      readFile,
    }),
    ValidationError,
  );
});

test('parseWindowsMetadataInputs: rejects non-integer windows-lang', async () => {
  await rejects(
    parseWindowsMetadataInputs({
      env: envOf({
        'windows-product-name': 'Foo',
        'windows-lang': 'abc',
      }),
    }),
    ValidationError,
  );
});

test('parseWindowsMetadataInputs: prefix="" reads bare sub-action input names', async () => {
  // The standalone windows-metadata sub-action uses `product-name`, not
  // `windows-product-name` — prefix="" lets the same parser serve both.
  const result = await parseWindowsMetadataInputs({
    env: envOf({
      'product-name': 'SubAction',
      lang: '1041',
    }),
    prefix: '',
  });
  ok(result !== null);
  strictEqual(result.productName, 'SubAction');
  strictEqual(result.lang, 1041);
});

test('parseWindowsMetadataInputs: metadata-file alone triggers parsing (no other env needed)', async () => {
  const readFile: ReadFileFn = async () => JSON.stringify({ productName: 'SoloFromFile' });
  const result = await parseWindowsMetadataInputs({
    env: envOf({ 'windows-metadata-file': '/meta.json' }),
    readFile,
  });
  ok(result !== null);
  strictEqual(result.productName, 'SoloFromFile');
});
