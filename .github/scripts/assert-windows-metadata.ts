// Verify that applyWindowsMetadata round-tripped the expected strings
// into a PE emitted by pkg-action (M3.6 e2e smoke).
//
// Usage: node --experimental-strip-types .github/scripts/assert-windows-metadata.ts <path-to-exe>
//
// Exits 0 on success, 1 with a `::error::` annotation otherwise. The
// expected values are hard-coded to match the windows-metadata job in
// .github/workflows/e2e.yml — keep the two in sync.

import { readFile } from 'node:fs/promises';
import { NtExecutable, NtExecutableResource, Resource } from 'resedit';

const EXPECTED: Record<string, string> = {
  ProductName: 'PkgActionTest',
  CompanyName: 'Acme Ltd',
  FileVersion: '1.2.3.4',
  FileDescription: 'pkg-action M3 smoke',
};

async function main(): Promise<void> {
  const exePath = process.argv[2];
  if (exePath === undefined) {
    console.error('::error::missing path argument');
    process.exit(1);
  }
  const raw = await readFile(exePath);
  const exe = NtExecutable.from(
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer,
    { ignoreCert: true },
  );
  const res = NtExecutableResource.from(exe);
  const [vi] = Resource.VersionInfo.fromEntries(res.entries);
  if (vi === undefined) {
    console.error('::error::no VS_VERSIONINFO in emitted binary');
    process.exit(1);
  }

  let failures = 0;
  // Scan every language block — applyWindowsMetadata writes to a single
  // lang/codepage pair but we want the assertion to be robust against a
  // future change that localizes strings.
  for (const lang of vi.getAllLanguagesForStringValues()) {
    const strings = vi.getStringValues(lang);
    for (const [key, expected] of Object.entries(EXPECTED)) {
      const actual = strings[key];
      if (actual !== expected) {
        console.error(
          `::error::VersionInfo.${key} = ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)} (lang=${lang.lang})`,
        );
        failures += 1;
      }
    }
    const ms = vi.fixedInfo.fileVersionMS;
    const ls = vi.fixedInfo.fileVersionLS;
    const fileVersion = [ms >>> 16, ms & 0xffff, ls >>> 16, ls & 0xffff].join('.');
    if (fileVersion !== EXPECTED.FileVersion) {
      console.error(
        `::error::VS_FIXEDFILEINFO fileVersion = ${fileVersion}, expected ${EXPECTED.FileVersion}`,
      );
      failures += 1;
    }
  }

  if (failures > 0) process.exit(1);
  console.log(`OK — VersionInfo round-trip verified on ${exePath}`);
}

main().catch((err: unknown) => {
  console.error('::error::assert-windows-metadata failed:', err);
  process.exit(1);
});
