import { test } from 'node:test';
import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict';
import {
  collectDependencyTree,
  renderCycloneDx,
  renderSpdx,
  SBOM_FORMATS,
  isSbomFormat,
  type DepNode,
  type SbomData,
  type SbomFsShim,
} from '../../src/sbom.ts';

// ─── Fs double ────────────────────────────────────────────────────────────
//
// Keys are absolute paths. Tests construct a small node_modules tree by hand.

function makeFs(tree: Record<string, string>): SbomFsShim {
  return {
    async readFile(path: string, _enc: 'utf8') {
      const body = tree[path];
      if (body === undefined) throw new Error(`ENOENT: ${path}`);
      return body;
    },
  };
}

const ROOT = '/app';

function pkg(
  name: string,
  version: string,
  deps: Record<string, string> = {},
  extras: Record<string, unknown> = {},
): string {
  return JSON.stringify({ name, version, dependencies: deps, ...extras });
}

// ─── Format registry ──────────────────────────────────────────────────────

test('SBOM_FORMATS exposes none/cyclonedx/spdx in stable order', () => {
  deepStrictEqual([...SBOM_FORMATS], ['none', 'cyclonedx', 'spdx']);
});

test('isSbomFormat: accepts only the three known values', () => {
  ok(isSbomFormat('none'));
  ok(isSbomFormat('cyclonedx'));
  ok(isSbomFormat('spdx'));
  ok(!isSbomFormat('CycloneDX'));
  ok(!isSbomFormat(''));
});

// ─── Dep-tree walker ──────────────────────────────────────────────────────

test('collectDependencyTree: empty deps → empty list', async () => {
  const fs = makeFs({
    [`${ROOT}/package.json`]: pkg('app', '1.0.0'),
  });
  const tree = await collectDependencyTree(ROOT, fs);
  deepStrictEqual(tree, []);
});

test('collectDependencyTree: walks direct deps + transitive', async () => {
  const fs = makeFs({
    [`${ROOT}/package.json`]: pkg('app', '1.0.0', { foo: '^1.0.0' }),
    [`${ROOT}/node_modules/foo/package.json`]: pkg('foo', '1.2.3', { bar: '^0.5.0' }),
    [`${ROOT}/node_modules/bar/package.json`]: pkg('bar', '0.5.1'),
  });
  const tree = await collectDependencyTree(ROOT, fs);
  strictEqual(tree.length, 2);
  const names = tree.map((d) => d.name);
  deepStrictEqual(names, ['bar', 'foo']); // alphabetical
});

test('collectDependencyTree: cycles are tolerated (seen-set breaks them)', async () => {
  const fs = makeFs({
    [`${ROOT}/package.json`]: pkg('app', '1.0.0', { foo: '^1.0.0' }),
    [`${ROOT}/node_modules/foo/package.json`]: pkg('foo', '1.0.0', { bar: '^1.0.0' }),
    [`${ROOT}/node_modules/bar/package.json`]: pkg('bar', '1.0.0', { foo: '^1.0.0' }),
  });
  const tree = await collectDependencyTree(ROOT, fs);
  strictEqual(tree.length, 2);
});

test('collectDependencyTree: ignores devDependencies', async () => {
  const fs = makeFs({
    [`${ROOT}/package.json`]: JSON.stringify({
      name: 'app',
      version: '1.0.0',
      dependencies: { foo: '^1.0.0' },
      devDependencies: { eslint: '^9' },
    }),
    [`${ROOT}/node_modules/foo/package.json`]: pkg('foo', '1.0.0'),
    [`${ROOT}/node_modules/eslint/package.json`]: pkg('eslint', '9.0.0'),
  });
  const tree = await collectDependencyTree(ROOT, fs);
  deepStrictEqual(
    tree.map((d) => d.name),
    ['foo'],
  );
});

test('collectDependencyTree: scoped packages get purl url-encoded', async () => {
  const fs = makeFs({
    [`${ROOT}/package.json`]: pkg('app', '1.0.0', { '@scope/pkg': '^1.0.0' }),
    [`${ROOT}/node_modules/@scope/pkg/package.json`]: pkg('@scope/pkg', '1.0.0'),
  });
  const tree = await collectDependencyTree(ROOT, fs);
  strictEqual(tree.length, 1);
  ok(tree[0]!.purl.startsWith('pkg:npm/%40scope%2Fpkg@1.0.0'));
});

test('collectDependencyTree: license object form normalized to string', async () => {
  const fs = makeFs({
    [`${ROOT}/package.json`]: pkg('app', '1.0.0', { foo: '^1.0.0' }),
    [`${ROOT}/node_modules/foo/package.json`]: pkg(
      'foo',
      '1.0.0',
      {},
      { license: { type: 'MIT' } },
    ),
  });
  const tree = await collectDependencyTree(ROOT, fs);
  strictEqual(tree[0]?.license, 'MIT');
});

test('collectDependencyTree: missing package.json is a hard error', async () => {
  const fs = makeFs({});
  await assertRejects(() => collectDependencyTree(ROOT, fs), /cannot read package.json/);
});

test('collectDependencyTree: missing node_modules entry is skipped (not an error)', async () => {
  const fs = makeFs({
    [`${ROOT}/package.json`]: pkg('app', '1.0.0', { missing: '^1.0.0' }),
  });
  const tree = await collectDependencyTree(ROOT, fs);
  deepStrictEqual(tree, []);
});

// ─── Renderers ────────────────────────────────────────────────────────────

const SAMPLE_DEPS: DepNode[] = [
  {
    name: 'foo',
    version: '1.2.3',
    purl: 'pkg:npm/foo@1.2.3',
    license: 'MIT',
    description: 'foo lib',
  },
];

const SAMPLE_DATA: SbomData = {
  project: { name: 'my-app', version: '0.1.0' },
  deps: SAMPLE_DEPS,
  artifacts: [
    {
      filename: 'my-app-0.1.0-linux-x64.tar.gz',
      hashes: [{ algo: 'SHA-256', value: 'a'.repeat(64) }],
    },
  ],
  actionVersion: '1.0.0',
  timestamp: '2026-04-20T00:00:00.000Z',
  serialNumber: '11111111-2222-3333-4444-555555555555',
};

test('renderCycloneDx: produces a valid CycloneDX 1.5 doc', () => {
  const json = JSON.parse(renderCycloneDx(SAMPLE_DATA)) as Record<string, unknown>;
  strictEqual(json['bomFormat'], 'CycloneDX');
  strictEqual(json['specVersion'], '1.5');
  strictEqual(json['serialNumber'], 'urn:uuid:11111111-2222-3333-4444-555555555555');
  const metadata = json['metadata'] as Record<string, unknown>;
  strictEqual((metadata['component'] as Record<string, unknown>)['name'], 'my-app');
  const comps = json['components'] as Array<Record<string, unknown>>;
  strictEqual(comps.length, 1);
  strictEqual(comps[0]!['name'], 'foo');
  strictEqual(comps[0]!['purl'], 'pkg:npm/foo@1.2.3');
  const formulation = json['formulation'] as Array<Record<string, unknown>>;
  ok(Array.isArray(formulation));
  const files = formulation[0]!['components'] as Array<Record<string, unknown>>;
  const hashes = files[0]!['hashes'] as Array<Record<string, unknown>>;
  strictEqual(hashes[0]!['alg'], 'SHA-256');
});

test('renderCycloneDx: drops formulation when no artifacts', () => {
  const json = JSON.parse(renderCycloneDx({ ...SAMPLE_DATA, artifacts: [] }));
  ok(!('formulation' in json));
});

test('renderSpdx: produces a valid SPDX 2.3 doc with relationships', () => {
  const json = JSON.parse(renderSpdx(SAMPLE_DATA)) as Record<string, unknown>;
  strictEqual(json['spdxVersion'], 'SPDX-2.3');
  strictEqual(json['dataLicense'], 'CC0-1.0');
  strictEqual(json['SPDXID'], 'SPDXRef-DOCUMENT');
  const packages = json['packages'] as Array<Record<string, unknown>>;
  // root + 1 dep + 1 file = 3
  strictEqual(packages.length, 3);
  const rootPkg = packages[0]!;
  strictEqual(rootPkg['name'], 'my-app');
  const relationships = json['relationships'] as Array<Record<string, unknown>>;
  const hasDescribes = relationships.some((r) => r['relationshipType'] === 'DESCRIBES');
  const hasDependsOn = relationships.some((r) => r['relationshipType'] === 'DEPENDS_ON');
  const hasGenerates = relationships.some((r) => r['relationshipType'] === 'GENERATES');
  ok(hasDescribes);
  ok(hasDependsOn);
  ok(hasGenerates);
});

test('renderSpdx: SPDX IDs are sanitized (no slashes/scope chars)', () => {
  const scoped: DepNode[] = [
    {
      name: '@scope/pkg',
      version: '1.0.0-beta.1',
      purl: 'pkg:npm/%40scope%2Fpkg@1.0.0-beta.1',
      license: undefined,
      description: undefined,
    },
  ];
  const json = JSON.parse(renderSpdx({ ...SAMPLE_DATA, deps: scoped, artifacts: [] }));
  const packages = json['packages'] as Array<Record<string, unknown>>;
  for (const p of packages) {
    const id = p['SPDXID'] as string;
    ok(/^SPDXRef-[A-Za-z0-9.\-]+$/.test(id), `bad SPDXID: ${id}`);
  }
});

test('renderSpdx: artifact checksum algo stripped of dash (SHA256 not SHA-256)', () => {
  const json = JSON.parse(renderSpdx(SAMPLE_DATA));
  const packages = json['packages'] as Array<Record<string, unknown>>;
  const file = packages.find((p) => (p['name'] as string).endsWith('.tar.gz'));
  ok(file);
  const checksums = file!['checksums'] as Array<Record<string, unknown>>;
  strictEqual(checksums[0]!['algorithm'], 'SHA256');
});

// ─── Local helpers ────────────────────────────────────────────────────────

async function assertRejects(fn: () => Promise<unknown>, re: RegExp): Promise<void> {
  try {
    await fn();
  } catch (err) {
    ok(err instanceof Error);
    ok(re.test(err.message), `expected error matching ${re.source}, got: ${err.message}`);
    return;
  }
  throw new Error(`expected function to reject with ${re.source}`);
}
