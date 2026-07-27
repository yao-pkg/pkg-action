// Unit tests for the per-binary finalize pipeline.
//
// The pipeline touches the real filesystem (rename / zip / checksum
// sidecars), so each test runs inside a throwaway temp dir. Everything that
// would shell out — codesign, signtool, azuresigntool — goes through a
// recording ExecFn double, so we assert on argv without a cert in sight.

import { test } from 'node:test';
import { deepStrictEqual, match, ok, rejects, strictEqual } from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { NtExecutable, NtExecutableResource, Resource } from 'resedit';
import {
  finalizeBinary,
  type FinalizeBinaryRequest,
  type FinalizeBinaryResult,
} from '../../src/finalize-binary.ts';
import type { PostBuildInputs } from '../../src/inputs.ts';
import { createTestLogger, type LoggerCall } from '../../src/logger.ts';
import type { ExecFn } from '../../src/pkg-runner.ts';
import type { SigningInputs } from '../../src/signing.ts';
import { SignError } from '../../src/errors.ts';
import { parseTarget } from '../../src/targets.ts';
import type { WindowsMetadataInputs } from '../../src/windows-metadata.ts';

// ─── Fakes ────────────────────────────────────────────────────────────────

interface ExecCall {
  command: string;
  args: readonly string[];
}

function makeRecordingExec(failOn?: string): { exec: ExecFn; calls: ExecCall[] } {
  const calls: ExecCall[] = [];
  const exec: ExecFn = async (command, args) => {
    calls.push({ command, args });
    const exitCode = failOn !== undefined && command === failOn ? 1 : 0;
    return { exitCode, stdout: '', stderr: '' };
  };
  return { exec, calls };
}

const ENV = {
  GITHUB_SHA: 'abcdef1234567890',
  GITHUB_REF: 'refs/tags/v1.2.3',
  GITHUB_REF_NAME: 'v1.2.3',
} as const;

const PROJECT = { name: 'tiny-app', version: '1.2.3' } as const;

function postBuild(overrides: Partial<PostBuildInputs> = {}): PostBuildInputs {
  return {
    strip: false,
    compress: 'none',
    filename: '{name}-{version}-{os}-{arch}',
    checksum: [],
    ...overrides,
  };
}

function windowsMeta(overrides: Partial<WindowsMetadataInputs> = {}): WindowsMetadataInputs {
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

function signingOf(overrides: Partial<SigningInputs> = {}): SigningInputs {
  return {
    macos: undefined,
    windowsMode: 'none',
    windowsSigntool: undefined,
    windowsTrusted: undefined,
    ...overrides,
  };
}

/** Round-trip an empty 64-bit PE through generate() so resedit accepts it. */
function emptyPE(): Uint8Array {
  return new Uint8Array(NtExecutable.createEmpty(false, false).generate());
}

interface Harness {
  readonly dir: string;
  readonly finalDir: string;
  readonly tempDir: string;
  readonly pkgOutPath: string;
  readonly calls: ExecCall[];
  readonly logs: LoggerCall[];
  run(overrides?: Partial<FinalizeBinaryRequest>): Promise<FinalizeBinaryResult>;
}

/**
 * Stage a fake pkg output on disk and hand back a `run()` that finalizes it.
 * `triple` drives both the target and the on-disk name pkg would have used.
 */
async function withHarness<T>(
  opts: {
    triple?: string;
    /** Bytes of the staged pkg output. Defaults to a text blob. */
    contents?: Uint8Array;
    /** Command whose exec call should report a non-zero exit. */
    failExecOn?: string;
  },
  fn: (h: Harness) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'pkgaction-finalize-'));
  try {
    const target = parseTarget(opts.triple ?? 'node22-linux-x64');
    const pkgOutDir = join(dir, 'pkg-out');
    const finalDir = join(dir, 'final');
    const tempDir = join(dir, 'temp');
    await mkdir(pkgOutDir, { recursive: true });
    await mkdir(finalDir, { recursive: true });
    await mkdir(tempDir, { recursive: true });
    const pkgOutPath = join(pkgOutDir, target.os === 'win' ? 'tiny-app.exe' : 'tiny-app');
    await writeFile(pkgOutPath, opts.contents ?? Buffer.from('binary payload'));

    const { exec, calls } = makeRecordingExec(opts.failExecOn);
    const { logger, calls: logs } = createTestLogger();

    const base: FinalizeBinaryRequest = {
      output: { target, path: pkgOutPath },
      project: PROJECT,
      postBuild: postBuild(),
      finalDir,
      windowsMetadata: null,
      signing: null,
      tempDir,
      env: ENV,
    };

    return await fn({
      dir,
      finalDir,
      tempDir,
      pkgOutPath,
      calls,
      logs,
      run: (overrides = {}) => finalizeBinary({ ...base, ...overrides }, { exec, logger }),
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

// ─── Rename ───────────────────────────────────────────────────────────────

test('finalizeBinary: renders the filename template and moves the binary into finalDir', async () => {
  await withHarness({}, async (h) => {
    const res = await h.run();
    strictEqual(res.binaryPath, join(h.finalDir, 'tiny-app-1.2.3-linux-x64'));
    strictEqual(res.artifactPath, res.binaryPath);
    strictEqual(await exists(h.pkgOutPath), false);
    strictEqual(await readFile(res.binaryPath, 'utf8'), 'binary payload');
  });
});

test('finalizeBinary: renders every runner-env token', async () => {
  await withHarness({}, async (h) => {
    const res = await h.run({ postBuild: postBuild({ filename: '{name}-{tag}-{sha}-{ref}' }) });
    strictEqual(basename(res.binaryPath), 'tiny-app-v1.2.3-abcdef1-v1.2.3');
  });
});

test('finalizeBinary: appends .exe for win targets when the template omits it', async () => {
  await withHarness({ triple: 'node22-win-x64' }, async (h) => {
    const res = await h.run();
    strictEqual(basename(res.binaryPath), 'tiny-app-1.2.3-win-x64.exe');
  });
});

test('finalizeBinary: does not double-append .exe when the template already ends in it', async () => {
  await withHarness({ triple: 'node22-win-x64' }, async (h) => {
    const res = await h.run({ postBuild: postBuild({ filename: '{name}.EXE' }) });
    strictEqual(basename(res.binaryPath), 'tiny-app.EXE');
  });
});

test('finalizeBinary: opens and closes a log group per binary', async () => {
  await withHarness({}, async (h) => {
    await h.run();
    const start = h.logs.find((c) => c.level === 'group-start');
    ok(start !== undefined);
    strictEqual(start.message, '[pkg-action] finalize node22-linux-x64 → tiny-app-1.2.3-linux-x64');
    ok(h.logs.some((c) => c.level === 'group-end'));
  });
});

// ─── Archive ──────────────────────────────────────────────────────────────

test('finalizeBinary: compress=zip archives beside the binary and reports both paths', async () => {
  await withHarness({}, async (h) => {
    const res = await h.run({ postBuild: postBuild({ compress: 'zip' }) });
    strictEqual(res.binaryPath, join(h.finalDir, 'tiny-app-1.2.3-linux-x64'));
    strictEqual(res.artifactPath, join(h.finalDir, 'tiny-app-1.2.3-linux-x64.zip'));
    ok(await exists(res.artifactPath));
    // The binary is kept — the `binaries` output points at it.
    ok(await exists(res.binaryPath));
    ok(h.logs.some((c) => c.message.startsWith('[pkg-action] archive → ')));
    ok(h.logs.some((c) => /^\[pkg-action] archived .*\(\d+ B, \d+\.\ds\)$/.test(c.message)));
  });
});

test('finalizeBinary: zip entry name keeps the .exe suffix for win targets', async () => {
  await withHarness({ triple: 'node22-win-x64' }, async (h) => {
    const res = await h.run({ postBuild: postBuild({ compress: 'zip' }) });
    // `.exe` is stripped from the archive name, not from the entry inside it.
    strictEqual(basename(res.artifactPath), 'tiny-app-1.2.3-win-x64.zip');
    const buf = await readFile(res.artifactPath);
    ok(buf.includes('tiny-app-1.2.3-win-x64.exe'));
  });
});

test('finalizeBinary: row size reflects the archive, not the binary', async () => {
  await withHarness({ contents: Buffer.alloc(4096, 7) }, async (h) => {
    const res = await h.run({ postBuild: postBuild({ compress: 'zip' }) });
    const { size } = await stat(res.artifactPath);
    strictEqual(res.row.sizeBytes, size);
    ok(res.row.sizeBytes < 4096, 'a 4 KiB run of the same byte must compress');
  });
});

// ─── Checksums ────────────────────────────────────────────────────────────

test('finalizeBinary: no checksum algorithms → no entries, no digests, no primary', async () => {
  await withHarness({}, async (h) => {
    const res = await h.run();
    deepStrictEqual(res.checksums, []);
    deepStrictEqual(res.digests, {});
    strictEqual(res.row.primaryDigest, undefined);
  });
});

test('finalizeBinary: writes one sidecar per algorithm and keys digests by artifact basename', async () => {
  await withHarness({}, async (h) => {
    const res = await h.run({ postBuild: postBuild({ checksum: ['sha256', 'md5'] }) });
    strictEqual(res.checksums.length, 2);
    deepStrictEqual(
      res.checksums.map((e) => e.algo),
      ['sha256', 'md5'],
    );
    for (const entry of res.checksums) {
      strictEqual(entry.path, `${res.artifactPath}.${entry.algo}`);
      const body = await readFile(entry.path, 'utf8');
      strictEqual(body, `${entry.digest}  ${basename(res.artifactPath)}\n`);
    }
    const key = basename(res.artifactPath);
    deepStrictEqual(Object.keys(res.digests), [key]);
    deepStrictEqual(Object.keys(res.digests[key] ?? {}), ['sha256', 'md5']);
    // The first requested algorithm is the one shown in the summary table.
    strictEqual(res.row.primaryDigest?.algo, 'sha256');
    strictEqual(res.row.primaryDigest?.value, res.checksums[0]?.digest);
    ok(h.logs.some((c) => c.message.includes(`sha256 ${res.checksums[0]?.digest ?? ''}`)));
  });
});

test('finalizeBinary: checksums cover the archive when compressing', async () => {
  await withHarness({}, async (h) => {
    const res = await h.run({ postBuild: postBuild({ compress: 'zip', checksum: ['sha512'] }) });
    strictEqual(basename(res.checksums[0]?.path ?? ''), 'tiny-app-1.2.3-linux-x64.zip.sha512');
  });
});

// ─── Windows metadata ─────────────────────────────────────────────────────

test('finalizeBinary: patches PE resources on win targets, defaulting OriginalFilename', async () => {
  await withHarness({ triple: 'node22-win-x64', contents: emptyPE() }, async (h) => {
    const res = await h.run({ windowsMetadata: windowsMeta({ productName: 'TinyApp' }) });
    const bytes = await readFile(res.binaryPath);
    const exe = NtExecutable.from(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      { ignoreCert: true },
    );
    const [version] = Resource.VersionInfo.fromEntries(NtExecutableResource.from(exe).entries);
    ok(version !== undefined);
    const strings = version.getStringValues({ lang: 1033, codepage: 1200 });
    strictEqual(strings['ProductName'], 'TinyApp');
    strictEqual(strings['OriginalFilename'], 'tiny-app-1.2.3-win-x64.exe');
    ok(
      h.logs.some(
        (c) => c.message === `[pkg-action] Patched Windows resources on ${res.binaryPath}.`,
      ),
    );
  });
});

test('finalizeBinary: keeps an explicit windows-original-filename', async () => {
  await withHarness({ triple: 'node22-win-x64', contents: emptyPE() }, async (h) => {
    const res = await h.run({ windowsMetadata: windowsMeta({ originalFilename: 'pinned.exe' }) });
    const bytes = await readFile(res.binaryPath);
    const exe = NtExecutable.from(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      { ignoreCert: true },
    );
    const [version] = Resource.VersionInfo.fromEntries(NtExecutableResource.from(exe).entries);
    strictEqual(
      version?.getStringValues({ lang: 1033, codepage: 1200 })['OriginalFilename'],
      'pinned.exe',
    );
  });
});

test('finalizeBinary: skips the resedit step for non-win targets', async () => {
  // A linux "binary" is not a PE — reaching resedit at all would throw.
  await withHarness({}, async (h) => {
    const res = await h.run({ windowsMetadata: windowsMeta({ productName: 'TinyApp' }) });
    strictEqual(await readFile(res.binaryPath, 'utf8'), 'binary payload');
    ok(!h.logs.some((c) => c.message.includes('Patched Windows resources')));
  });
});

// ─── Signing ──────────────────────────────────────────────────────────────

test('finalizeBinary: unsigned rows carry no `signed` flag', async () => {
  await withHarness({}, async (h) => {
    const res = await h.run();
    strictEqual(res.row.signed, undefined);
    strictEqual(res.macosKeychain, undefined);
    strictEqual(h.calls.length, 0);
  });
});

test('finalizeBinary: macOS signing runs codesign and hands back the keychain path', async () => {
  await withHarness({ triple: 'node22-macos-arm64' }, async (h) => {
    const res = await h.run({
      signing: signingOf({
        macos: {
          identity: 'Developer ID Application: Acme',
          certificate: Buffer.from('p12-bytes').toString('base64'),
          keychainPassword: 'hunter2',
          entitlements: undefined,
          notarize: false,
          appleId: undefined,
          teamId: undefined,
          appPassword: undefined,
        },
      }),
    });
    strictEqual(res.row.signed, true);
    ok(res.macosKeychain !== undefined);
    ok(res.macosKeychain.startsWith(h.tempDir));
    const codesign = h.calls.find((c) => c.command === 'codesign');
    ok(codesign !== undefined);
    ok(codesign.args.includes(res.binaryPath));
    ok(h.calls.some((c) => c.command === 'security' && c.args[0] === 'create-keychain'));
  });
});

test('finalizeBinary: windows signtool signing sets `signed` without a keychain', async () => {
  await withHarness({ triple: 'node22-win-x64' }, async (h) => {
    const res = await h.run({
      signing: signingOf({
        windowsMode: 'signtool',
        windowsSigntool: {
          certificate: Buffer.from('pfx-bytes').toString('base64'),
          password: 'pw',
          timestampUrl: 'http://timestamp.digicert.com',
          description: undefined,
        },
      }),
    });
    strictEqual(res.row.signed, true);
    strictEqual(res.macosKeychain, undefined);
    deepStrictEqual(
      h.calls.map((c) => `${c.command} ${c.args[0] ?? ''}`),
      ['signtool sign', 'signtool verify'],
    );
  });
});

test('finalizeBinary: azure trusted-signing path signs win targets', async () => {
  await withHarness({ triple: 'node22-win-x64' }, async (h) => {
    const res = await h.run({
      signing: signingOf({
        windowsMode: 'trusted-signing',
        windowsTrusted: {
          tenantId: 't',
          clientId: 'c',
          clientSecret: 's',
          endpoint: 'https://eus.codesigning.azure.net',
          certProfile: 'profile',
          description: 'TinyApp',
        },
      }),
    });
    strictEqual(res.row.signed, true);
    strictEqual(h.calls[0]?.command, 'azuresigntool');
  });
});

test('finalizeBinary: signing configured for another OS leaves the binary unsigned', async () => {
  await withHarness({}, async (h) => {
    const res = await h.run({
      signing: signingOf({
        windowsMode: 'signtool',
        windowsSigntool: {
          certificate: 'AA==',
          password: 'pw',
          timestampUrl: 'http://timestamp.digicert.com',
          description: undefined,
        },
      }),
    });
    strictEqual(res.row.signed, undefined);
    strictEqual(h.calls.length, 0);
  });
});

test('finalizeBinary: a failing signing tool propagates and still closes the log group', async () => {
  await withHarness({ triple: 'node22-win-x64', failExecOn: 'signtool' }, async (h) => {
    await rejects(
      () =>
        h.run({
          signing: signingOf({
            windowsMode: 'signtool',
            windowsSigntool: {
              certificate: 'AA==',
              password: 'pw',
              timestampUrl: 'http://timestamp.digicert.com',
              description: undefined,
            },
          }),
        }),
      SignError,
    );
    ok(h.logs.some((c) => c.level === 'group-end'));
  });
});

// ─── Summary row ──────────────────────────────────────────────────────────

test('finalizeBinary: row reports the formatted target and the artifact path', async () => {
  await withHarness({ triple: 'latest-macos-arm64' }, async (h) => {
    const res = await h.run({ postBuild: postBuild({ checksum: ['sha256'] }) });
    strictEqual(res.row.target, 'latest-macos-arm64');
    strictEqual(res.row.filename, res.artifactPath);
    match(res.row.primaryDigest?.value ?? '', /^[0-9a-f]{64}$/);
    strictEqual(res.row.sizeBytes, (await stat(res.artifactPath)).size);
  });
});
