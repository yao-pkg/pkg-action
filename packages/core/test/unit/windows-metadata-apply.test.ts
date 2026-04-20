// Unit tests for applyWindowsMetadata.
//
// We use DI-style doubles for all file I/O: readFile/writeFile are
// in-memory maps. For the "input binary" we cannot realistically fake a
// PE — resedit strictly parses the NT headers — so we bootstrap with
// `NtExecutable.createEmpty()` and round-trip through `.generate()` to
// produce a valid empty PE that resedit will accept on the next read.
// After applyWindowsMetadata runs, we re-parse the written buffer and
// assert on the in-memory resource tree.

import { test } from 'node:test';
import { deepStrictEqual, ok, rejects, strictEqual } from 'node:assert/strict';
import { NtExecutable, NtExecutableResource, Resource } from 'resedit';
import {
  applyWindowsMetadata,
  type WindowsMetadataApplyDeps,
} from '../../src/windows-metadata-apply.ts';
import type { WindowsMetadataInputs } from '../../src/windows-metadata.ts';
import { ResEditError, ValidationError } from '../../src/errors.ts';

// ─── Fakes ────────────────────────────────────────────────────────────────

/** Round-trip an empty 64-bit PE through generate() so the result is a
 *  structurally-valid binary that resedit will parse cleanly. */
function emptyPE(): Uint8Array {
  const exe = NtExecutable.createEmpty(false, false);
  return new Uint8Array(exe.generate());
}

function makeFakeFs(initial: Record<string, Uint8Array> = {}): {
  deps: WindowsMetadataApplyDeps;
  files: Map<string, Uint8Array>;
} {
  const files = new Map<string, Uint8Array>(Object.entries(initial));
  const deps: WindowsMetadataApplyDeps = {
    readFile: async (path) => {
      const bytes = files.get(path);
      if (bytes === undefined) throw new Error(`ENOENT: ${path}`);
      return bytes;
    },
    writeFile: async (path, data) => {
      files.set(path, new Uint8Array(data));
    },
  };
  return { deps, files };
}

function makeMeta(overrides: Partial<WindowsMetadataInputs> = {}): WindowsMetadataInputs {
  return {
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
    lang: 1033,
    codepage: 1200,
    ...overrides,
  };
}

/** Parse a patched PE and return the VersionInfo instance (first one found) +
 *  the full resource-entry array for ad-hoc assertions. */
function readBack(bytes: Uint8Array): {
  version: Resource.VersionInfo | undefined;
  entries: ReturnType<typeof NtExecutableResource.from>['entries'];
} {
  const exe = NtExecutable.from(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    {
      ignoreCert: true,
    },
  );
  const res = NtExecutableResource.from(exe);
  const [firstVi] = Resource.VersionInfo.fromEntries(res.entries);
  return { version: firstVi, entries: res.entries };
}

// ─── Tests ────────────────────────────────────────────────────────────────

test('applyWindowsMetadata: no-op when meta has no fields set', async () => {
  const { deps, files } = makeFakeFs({ '/in.exe': emptyPE() });
  await applyWindowsMetadata('/in.exe', '/out.exe', makeMeta(), deps);
  const written = files.get('/out.exe');
  ok(written !== undefined);
  // No VersionInfo should have been injected.
  strictEqual(readBack(written).version, undefined);
});

test('applyWindowsMetadata: writes product-name and company-name strings', async () => {
  const { deps, files } = makeFakeFs({ '/in.exe': emptyPE() });
  await applyWindowsMetadata(
    '/in.exe',
    '/out.exe',
    makeMeta({ productName: 'TinyApp', companyName: 'Acme Ltd' }),
    deps,
  );
  const { version } = readBack(files.get('/out.exe') as Uint8Array);
  ok(version !== undefined);
  const strings = version.getStringValues({ lang: 1033, codepage: 1200 });
  strictEqual(strings['ProductName'], 'TinyApp');
  strictEqual(strings['CompanyName'], 'Acme Ltd');
  // Auto-generated © copyright should reference the company name.
  ok((strings['LegalCopyright'] ?? '').includes('Acme Ltd'));
});

test('applyWindowsMetadata: explicit legal-copyright wins over auto-generated one', async () => {
  const { deps, files } = makeFakeFs({ '/in.exe': emptyPE() });
  await applyWindowsMetadata(
    '/in.exe',
    '/out.exe',
    makeMeta({ companyName: 'Acme Ltd', legalCopyright: 'Public Domain — no copyright.' }),
    deps,
  );
  const { version } = readBack(files.get('/out.exe') as Uint8Array);
  ok(version !== undefined);
  strictEqual(
    version.getStringValues({ lang: 1033, codepage: 1200 })['LegalCopyright'],
    'Public Domain — no copyright.',
  );
});

test('applyWindowsMetadata: encodes fileVersion into VS_FIXEDFILEINFO', async () => {
  const { deps, files } = makeFakeFs({ '/in.exe': emptyPE() });
  await applyWindowsMetadata('/in.exe', '/out.exe', makeMeta({ fileVersion: '3.4.5.6' }), deps);
  const { version } = readBack(files.get('/out.exe') as Uint8Array);
  ok(version !== undefined);
  // fileVersionMS packs major<<16 | minor; fileVersionLS packs micro<<16 | revision.
  strictEqual(version.fixedInfo.fileVersionMS, (3 << 16) | 4);
  strictEqual(version.fixedInfo.fileVersionLS, (5 << 16) | 6);
  strictEqual(version.getStringValues({ lang: 1033, codepage: 1200 })['FileVersion'], '3.4.5.6');
});

test('applyWindowsMetadata: honors a non-default lang/codepage pair', async () => {
  const { deps, files } = makeFakeFs({ '/in.exe': emptyPE() });
  await applyWindowsMetadata(
    '/in.exe',
    '/out.exe',
    makeMeta({ productName: 'Foo', lang: 1041, codepage: 932 }),
    deps,
  );
  const { version } = readBack(files.get('/out.exe') as Uint8Array);
  ok(version !== undefined);
  const strings = version.getStringValues({ lang: 1041, codepage: 932 });
  strictEqual(strings['ProductName'], 'Foo');
});

test('applyWindowsMetadata: embeds a raw manifest at RT_MANIFEST id 1', async () => {
  const manifestBody = Buffer.from('<assembly xmlns="urn:schemas-microsoft-com:asm.v1"/>');
  const { deps, files } = makeFakeFs({
    '/in.exe': emptyPE(),
    '/tmp/app.manifest': manifestBody,
  });
  await applyWindowsMetadata(
    '/in.exe',
    '/out.exe',
    makeMeta({ manifestPath: '/tmp/app.manifest' }),
    deps,
  );
  const { entries } = readBack(files.get('/out.exe') as Uint8Array);
  const manifestEntry = entries.find((e) => e.type === 24 && e.id === 1);
  ok(manifestEntry !== undefined);
  deepStrictEqual(new Uint8Array(manifestEntry.bin), new Uint8Array(manifestBody));
});

test('applyWindowsMetadata: rejects non-PE input with ResEditError', async () => {
  const { deps } = makeFakeFs({ '/in.exe': Buffer.from('this is not a PE file') });
  await rejects(
    applyWindowsMetadata('/in.exe', '/out.exe', makeMeta({ productName: 'Foo' }), deps),
    ResEditError,
  );
});

test('applyWindowsMetadata: rejects invalid fileVersion BEFORE reading the PE', async () => {
  // readFile is a spy that explodes — if we reach it the test fails.
  const deps: WindowsMetadataApplyDeps = {
    readFile: async () => {
      throw new Error('readFile should not be called');
    },
    writeFile: async () => {
      throw new Error('writeFile should not be called');
    },
  };
  await rejects(
    applyWindowsMetadata('/in.exe', '/out.exe', makeMeta({ fileVersion: '1.0.0-beta' }), deps),
    ValidationError,
  );
});

test('applyWindowsMetadata: surfaces missing icon file as ResEditError', async () => {
  const { deps } = makeFakeFs({ '/in.exe': emptyPE() });
  // /missing.ico is not in the fake fs — readFile throws ENOENT.
  await rejects(
    applyWindowsMetadata(
      '/in.exe',
      '/out.exe',
      makeMeta({ icons: [{ id: 1, path: '/missing.ico' }] }),
      deps,
    ),
    ResEditError,
  );
});

test('applyWindowsMetadata: in-place rewrite (input === output) succeeds', async () => {
  const { deps, files } = makeFakeFs({ '/pkg.exe': emptyPE() });
  await applyWindowsMetadata('/pkg.exe', '/pkg.exe', makeMeta({ productName: 'Foo' }), deps);
  const { version } = readBack(files.get('/pkg.exe') as Uint8Array);
  ok(version !== undefined);
  strictEqual(version.getStringValues({ lang: 1033, codepage: 1200 })['ProductName'], 'Foo');
});
