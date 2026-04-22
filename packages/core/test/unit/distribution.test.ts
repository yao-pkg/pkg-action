import { test } from 'node:test';
import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert/strict';
import {
  buildReleaseAssetUrl,
  renderHomebrewFormula,
  renderScoopManifest,
  type DistAsset,
} from '../../src/distribution.ts';

const SHA_MAC_ARM = 'a'.repeat(64);
const SHA_MAC_X64 = 'b'.repeat(64);
const SHA_WIN_X64 = 'c'.repeat(64);
const SHA_LINUX_X64 = 'd'.repeat(64);

function asset(over: Partial<DistAsset>): DistAsset {
  return {
    os: 'macos',
    arch: 'arm64',
    url: 'https://example.test/binary',
    sha256: SHA_MAC_ARM,
    assetName: 'my-app-1.0.0-macos-arm64.tar.gz',
    extractDir: 'my-app-1.0.0-macos-arm64',
    ...over,
  };
}

// ─── Release-asset URL ────────────────────────────────────────────────────

test('buildReleaseAssetUrl: url-encodes each path segment', () => {
  const url = buildReleaseAssetUrl('yao-pkg', 'pkg-action', 'v1.0.0', 'a b c.tar.gz');
  strictEqual(
    url,
    'https://github.com/yao-pkg/pkg-action/releases/download/v1.0.0/a%20b%20c.tar.gz',
  );
});

// ─── Homebrew renderer ────────────────────────────────────────────────────

test('renderHomebrewFormula: emits class + on_macos blocks for arm64 + intel', () => {
  const body = renderHomebrewFormula({
    formulaName: 'my-app',
    description: 'Test tool',
    homepage: 'https://example.test',
    version: '1.0.0',
    license: 'MIT',
    assets: [
      asset({ os: 'macos', arch: 'arm64', sha256: SHA_MAC_ARM }),
      asset({
        os: 'macos',
        arch: 'x64',
        sha256: SHA_MAC_X64,
        assetName: 'my-app-1.0.0-macos-x64.tar.gz',
        url: 'https://example.test/x64',
      }),
    ],
  });
  ok(body.startsWith('class MyApp < Formula'));
  ok(body.includes('desc "Test tool"'));
  ok(body.includes('homepage "https://example.test"'));
  ok(body.includes('version "1.0.0"'));
  ok(body.includes('license "MIT"'));
  ok(body.includes('on_macos do'));
  ok(body.includes('on_arm do'));
  ok(body.includes('on_intel do'));
  ok(body.includes(`sha256 "${SHA_MAC_ARM}"`));
  ok(body.includes(`sha256 "${SHA_MAC_X64}"`));
  ok(body.includes('bin.install "my-app"'));
  ok(body.endsWith('\n'));
});

test('renderHomebrewFormula: derives PascalCase class name from formula-name', () => {
  const body = renderHomebrewFormula({
    formulaName: 'foo-bar-baz',
    description: 'd',
    homepage: 'https://x',
    version: '1',
    license: undefined,
    assets: [asset({ os: 'macos', arch: 'arm64' })],
  });
  ok(body.startsWith('class FooBarBaz < Formula'));
});

test('renderHomebrewFormula: skips license line when unset', () => {
  const body = renderHomebrewFormula({
    formulaName: 'my-app',
    description: 'd',
    homepage: 'https://x',
    version: '1',
    license: undefined,
    assets: [asset({ os: 'macos', arch: 'arm64' })],
  });
  ok(!body.includes('license '));
});

test('renderHomebrewFormula: emits on_linux block when linux assets provided', () => {
  const body = renderHomebrewFormula({
    formulaName: 'my-app',
    description: 'd',
    homepage: 'https://x',
    version: '1',
    license: undefined,
    assets: [
      asset({ os: 'macos', arch: 'arm64' }),
      asset({
        os: 'linux',
        arch: 'x64',
        sha256: SHA_LINUX_X64,
        assetName: 'my-app-1.0.0-linux-x64.tar.gz',
      }),
    ],
  });
  ok(body.includes('on_linux do'));
  ok(body.includes(`sha256 "${SHA_LINUX_X64}"`));
});

test('renderHomebrewFormula: escapes quote characters in description', () => {
  const body = renderHomebrewFormula({
    formulaName: 'my-app',
    description: 'a "quoted" desc',
    homepage: 'https://x',
    version: '1',
    license: undefined,
    assets: [asset({ os: 'macos', arch: 'arm64' })],
  });
  ok(body.includes('desc "a \\"quoted\\" desc"'));
});

test('renderHomebrewFormula: requires at least one mac or linux asset', () => {
  throws(
    () =>
      renderHomebrewFormula({
        formulaName: 'my-app',
        description: 'd',
        homepage: 'https://x',
        version: '1',
        license: undefined,
        assets: [asset({ os: 'win', arch: 'x64' })],
      }),
    /requires at least one macOS or Linux/,
  );
});

test('renderHomebrewFormula: honors explicit binary override', () => {
  const body = renderHomebrewFormula({
    formulaName: 'my-app',
    description: 'd',
    homepage: 'https://x',
    version: '1',
    license: undefined,
    assets: [asset({ os: 'macos', arch: 'arm64' })],
    binary: 'myapp-bin',
  });
  ok(body.includes('bin.install "myapp-bin"'));
  ok(body.includes('#{bin}/myapp-bin'));
});

// ─── Scoop renderer ───────────────────────────────────────────────────────

test('renderScoopManifest: emits architecture.64bit block with hash prefix', () => {
  const body = renderScoopManifest({
    manifestName: 'my-app',
    description: 'Test tool',
    homepage: 'https://example.test',
    version: '1.0.0',
    license: 'MIT',
    assets: [
      asset({
        os: 'win',
        arch: 'x64',
        sha256: SHA_WIN_X64,
        url: 'https://example.test/win-x64.zip',
        assetName: 'my-app-1.0.0-win-x64.zip',
        extractDir: 'my-app-1.0.0-win-x64',
      }),
    ],
  });
  const doc = JSON.parse(body) as Record<string, unknown>;
  strictEqual(doc['version'], '1.0.0');
  strictEqual(doc['description'], 'Test tool');
  strictEqual(doc['homepage'], 'https://example.test');
  strictEqual(doc['license'], 'MIT');
  const arch = doc['architecture'] as Record<string, unknown>;
  ok('64bit' in arch);
  const x64 = arch['64bit'] as Record<string, unknown>;
  strictEqual(x64['url'], 'https://example.test/win-x64.zip');
  strictEqual(x64['hash'], `sha256:${SHA_WIN_X64}`);
  strictEqual(x64['bin'], 'my-app.exe');
  strictEqual(x64['extract_dir'], 'my-app-1.0.0-win-x64');
});

test('renderScoopManifest: arm64 maps to the arm64 arch key', () => {
  const body = renderScoopManifest({
    manifestName: 'my-app',
    description: 'd',
    homepage: 'https://x',
    version: '1',
    license: undefined,
    assets: [
      asset({
        os: 'win',
        arch: 'arm64',
        url: 'https://example.test/win-arm64.zip',
        assetName: 'my-app-1.0.0-win-arm64.zip',
        extractDir: 'my-app-1.0.0-win-arm64',
      }),
    ],
  });
  const doc = JSON.parse(body) as Record<string, unknown>;
  const arch = doc['architecture'] as Record<string, unknown>;
  ok('arm64' in arch);
  ok(!('64bit' in arch));
});

test('renderScoopManifest: drops extract_dir when empty (compress=none)', () => {
  const body = renderScoopManifest({
    manifestName: 'my-app',
    description: 'd',
    homepage: 'https://x',
    version: '1',
    license: undefined,
    assets: [
      asset({
        os: 'win',
        arch: 'x64',
        assetName: 'my-app.exe',
        extractDir: '',
      }),
    ],
  });
  const doc = JSON.parse(body) as Record<string, unknown>;
  const x64 = (doc['architecture'] as Record<string, unknown>)['64bit'] as Record<string, unknown>;
  ok(!('extract_dir' in x64));
});

test('renderScoopManifest: requires at least one Windows asset', () => {
  throws(
    () =>
      renderScoopManifest({
        manifestName: 'my-app',
        description: 'd',
        homepage: 'https://x',
        version: '1',
        license: undefined,
        assets: [asset({ os: 'macos', arch: 'arm64' })],
      }),
    /requires at least one Windows/,
  );
});

test('renderScoopManifest: honors explicit binary override', () => {
  const body = renderScoopManifest({
    manifestName: 'my-app',
    description: 'd',
    homepage: 'https://x',
    version: '1',
    license: undefined,
    assets: [asset({ os: 'win', arch: 'x64' })],
    binary: 'myapp-cli.exe',
  });
  const doc = JSON.parse(body) as Record<string, unknown>;
  const x64 = (doc['architecture'] as Record<string, unknown>)['64bit'] as Record<string, unknown>;
  strictEqual(x64['bin'], 'myapp-cli.exe');
});

test('renderScoopManifest: trailing newline for poka-yoke diffs', () => {
  const body = renderScoopManifest({
    manifestName: 'my-app',
    description: 'd',
    homepage: 'https://x',
    version: '1',
    license: undefined,
    assets: [asset({ os: 'win', arch: 'x64' })],
  });
  ok(body.endsWith('\n'));
});

// Silence unused-var noise.
void deepStrictEqual;
