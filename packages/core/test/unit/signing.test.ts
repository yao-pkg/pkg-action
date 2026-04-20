// Unit tests for packages/core/src/signing.ts.
//
// Shell tools (security, codesign, xcrun, signtool, azuresigntool) are
// mocked via a recording ExecFn double. We assert on the exact argv the
// driver emits — any drift is a behavior change worth flagging.

import { test } from 'node:test';
import { deepStrictEqual, ok, rejects, strictEqual, throws } from 'node:assert/strict';
import {
  parseSigningInputs,
  signMacos,
  signWindowsSigntool,
  signWindowsTrustedSigning,
  type SigningDeps,
} from '../../src/signing.ts';
import { SignError, ValidationError } from '../../src/errors.ts';
import { createTestLogger } from '../../src/logger.ts';
import type { ExecFn } from '../../src/pkg-runner.ts';

// ─── Fakes ────────────────────────────────────────────────────────────────

interface ExecCall {
  command: string;
  args: readonly string[];
  env: Readonly<Record<string, string>> | undefined;
}

function makeRecordingExec(
  results: Array<{ exitCode: number; stdout?: string; stderr?: string }> = [],
): { exec: ExecFn; calls: ExecCall[] } {
  const calls: ExecCall[] = [];
  let cursor = 0;
  const exec: ExecFn = async (command, args, options) => {
    calls.push({ command, args, env: options.env });
    const result = results[cursor] ?? { exitCode: 0, stdout: '', stderr: '' };
    cursor += 1;
    return { exitCode: result.exitCode, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  };
  return { exec, calls };
}

function makeDeps(exec: ExecFn): SigningDeps & { writtenFiles: Map<string, Uint8Array> } {
  const writtenFiles = new Map<string, Uint8Array>();
  const { logger } = createTestLogger();
  return {
    exec,
    logger,
    tempDir: '/tmp/signing-test',
    writeFile: async (path, data) => {
      writtenFiles.set(path, new Uint8Array(data));
    },
    writtenFiles,
  };
}

const envOf = (bag: Record<string, string | undefined>): Record<string, string | undefined> => {
  const out: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(bag)) {
    if (v === undefined) continue;
    out[`INPUT_${k.toUpperCase()}`] = v;
  }
  return out;
};

// ─── parseSigningInputs ───────────────────────────────────────────────────

test('parseSigningInputs: returns null when no signing is requested', () => {
  strictEqual(parseSigningInputs({ env: {} }), null);
});

test('parseSigningInputs: macOS requires identity+cert+keychain together', () => {
  throws(
    () => parseSigningInputs({ env: envOf({ 'macos-sign-identity': 'Apple Dev ID' }) }),
    ValidationError,
  );
});

test('parseSigningInputs: macOS full happy path + secrets registered', () => {
  const registered: string[] = [];
  const result = parseSigningInputs({
    env: envOf({
      'macos-sign-identity': 'Apple Dev ID',
      'macos-sign-certificate': 'BASE64P12',
      'macos-keychain-password': 'pw',
    }),
    registerSecret: (v) => registered.push(v),
  });
  ok(result !== null);
  ok(result.macos !== undefined);
  strictEqual(result.macos.identity, 'Apple Dev ID');
  ok(registered.includes('BASE64P12'));
  ok(registered.includes('pw'));
});

test('parseSigningInputs: macos-notarize=true demands apple-id/team-id/app-password', () => {
  throws(
    () =>
      parseSigningInputs({
        env: envOf({
          'macos-sign-identity': 'Apple Dev ID',
          'macos-sign-certificate': 'B',
          'macos-keychain-password': 'p',
          'macos-notarize': 'true',
        }),
      }),
    ValidationError,
  );
});

test('parseSigningInputs: Windows signtool — happy path', () => {
  const result = parseSigningInputs({
    env: envOf({
      'windows-sign-mode': 'signtool',
      'windows-sign-cert': 'BASE64PFX',
      'windows-sign-password': 'pw',
      'windows-sign-description': 'TinyApp',
    }),
  });
  ok(result !== null);
  ok(result.windowsSigntool !== undefined);
  strictEqual(result.windowsSigntool.description, 'TinyApp');
  // Timestamp URL picks up the spec default.
  strictEqual(result.windowsSigntool.timestampUrl, 'http://timestamp.digicert.com');
});

test('parseSigningInputs: Windows signtool rejects mixing with azure-*', () => {
  throws(
    () =>
      parseSigningInputs({
        env: envOf({
          'windows-sign-mode': 'signtool',
          'windows-sign-cert': 'B',
          'windows-sign-password': 'p',
          'azure-tenant-id': 'T',
        }),
      }),
    ValidationError,
  );
});

test('parseSigningInputs: trusted-signing requires all five azure-* fields', () => {
  throws(
    () =>
      parseSigningInputs({
        env: envOf({
          'windows-sign-mode': 'trusted-signing',
          'azure-tenant-id': 'T',
          'azure-client-id': 'C',
        }),
      }),
    ValidationError,
  );
});

test('parseSigningInputs: trusted-signing — happy path', () => {
  const result = parseSigningInputs({
    env: envOf({
      'windows-sign-mode': 'trusted-signing',
      'azure-tenant-id': 'T',
      'azure-client-id': 'C',
      'azure-client-secret': 'S',
      'azure-endpoint': 'https://eu.codesigning.azure.net',
      'azure-cert-profile': 'my-profile',
    }),
  });
  ok(result !== null);
  ok(result.windowsTrusted !== undefined);
  strictEqual(result.windowsTrusted.endpoint, 'https://eu.codesigning.azure.net');
});

test('parseSigningInputs: invalid windows-sign-mode rejected', () => {
  throws(
    () => parseSigningInputs({ env: envOf({ 'windows-sign-mode': 'bogus' }) }),
    ValidationError,
  );
});

// ─── signMacos ────────────────────────────────────────────────────────────

test('signMacos: emits the expected security + codesign command sequence', async () => {
  const { exec, calls } = makeRecordingExec();
  const deps = makeDeps(exec);
  await signMacos(
    '/tmp/app',
    {
      identity: 'Apple Dev ID',
      certificate: Buffer.from('fake-p12').toString('base64'),
      keychainPassword: 'pw',
      entitlements: undefined,
      notarize: false,
      appleId: undefined,
      teamId: undefined,
      appPassword: undefined,
    },
    deps,
  );
  // Expect: create-keychain, set-keychain-settings, unlock-keychain, import,
  // set-key-partition-list, codesign. No notarytool because notarize=false.
  strictEqual(calls.length, 6);
  strictEqual(calls[0]?.command, 'security');
  strictEqual(calls[0]?.args[0], 'create-keychain');
  strictEqual(calls[1]?.args[0], 'set-keychain-settings');
  strictEqual(calls[2]?.args[0], 'unlock-keychain');
  strictEqual(calls[3]?.args[0], 'import');
  strictEqual(calls[4]?.args[0], 'set-key-partition-list');
  strictEqual(calls[5]?.command, 'codesign');
  ok(calls[5]?.args.includes('--options'));
  ok(calls[5]?.args.includes('runtime'));
  // .p12 should have been written to disk.
  strictEqual(deps.writtenFiles.size, 1);
});

test('signMacos: passes --entitlements when supplied', async () => {
  const { exec, calls } = makeRecordingExec();
  const deps = makeDeps(exec);
  await signMacos(
    '/tmp/app',
    {
      identity: 'Apple Dev ID',
      certificate: Buffer.from('p12').toString('base64'),
      keychainPassword: 'pw',
      entitlements: '/tmp/entitlements.plist',
      notarize: false,
      appleId: undefined,
      teamId: undefined,
      appPassword: undefined,
    },
    deps,
  );
  const codesign = calls.find((c) => c.command === 'codesign');
  ok(codesign !== undefined);
  const idx = codesign.args.indexOf('--entitlements');
  ok(idx >= 0);
  strictEqual(codesign.args[idx + 1], '/tmp/entitlements.plist');
});

test('signMacos: notarize=true chains notarytool submit', async () => {
  const { exec, calls } = makeRecordingExec();
  const deps = makeDeps(exec);
  await signMacos(
    '/tmp/app',
    {
      identity: 'Apple Dev ID',
      certificate: Buffer.from('p12').toString('base64'),
      keychainPassword: 'pw',
      entitlements: undefined,
      notarize: true,
      appleId: 'apple@example.com',
      teamId: 'TEAM123',
      appPassword: 'app-specific',
    },
    deps,
  );
  const notary = calls.find((c) => c.command === 'xcrun');
  ok(notary !== undefined);
  deepStrictEqual(notary.args.slice(0, 3), ['notarytool', 'submit', '/tmp/app']);
  ok(notary.args.includes('--wait'));
  ok(notary.args.includes('--apple-id'));
  ok(notary.args.includes('apple@example.com'));
});

test('signMacos: surfaces non-zero exec exit as SignError', async () => {
  const { exec } = makeRecordingExec([{ exitCode: 1, stderr: 'kaboom' }]);
  const deps = makeDeps(exec);
  await rejects(
    signMacos(
      '/tmp/app',
      {
        identity: 'X',
        certificate: Buffer.from('p').toString('base64'),
        keychainPassword: 'pw',
        entitlements: undefined,
        notarize: false,
        appleId: undefined,
        teamId: undefined,
        appPassword: undefined,
      },
      deps,
    ),
    SignError,
  );
});

// ─── signWindowsSigntool ──────────────────────────────────────────────────

test('signWindowsSigntool: emits the expected /fd /td /tr /f /p argv', async () => {
  const { exec, calls } = makeRecordingExec();
  const deps = makeDeps(exec);
  await signWindowsSigntool(
    'C:\\out\\app.exe',
    {
      certificate: Buffer.from('pfx').toString('base64'),
      password: 'pw',
      timestampUrl: 'http://timestamp.digicert.com',
      description: 'TinyApp',
    },
    deps,
  );
  strictEqual(calls.length, 1);
  const call = calls[0];
  ok(call !== undefined);
  strictEqual(call.command, 'signtool');
  strictEqual(call.args[0], 'sign');
  ok(call.args.includes('/fd'));
  ok(call.args.includes('sha256'));
  ok(call.args.includes('/tr'));
  ok(call.args.includes('http://timestamp.digicert.com'));
  ok(call.args.includes('/d'));
  ok(call.args.includes('TinyApp'));
  // /f <pfx-path> — the path is the temp file, not the base64.
  const fIdx = call.args.indexOf('/f');
  ok(fIdx >= 0);
  const pfxPath = call.args[fIdx + 1];
  ok(pfxPath !== undefined);
  ok(pfxPath.endsWith('.pfx'));
  // The .pfx must actually have been written.
  ok(deps.writtenFiles.has(pfxPath));
  // The base64 payload must never appear as an argv token.
  ok(
    !call.args.some((a) => a === Buffer.from('pfx').toString('base64')),
    'signtool argv must not leak the raw base64 cert payload',
  );
  // Binary path is the last positional.
  strictEqual(call.args[call.args.length - 1], 'C:\\out\\app.exe');
});

test('signWindowsSigntool: omits /d when description is unset', async () => {
  const { exec, calls } = makeRecordingExec();
  const deps = makeDeps(exec);
  await signWindowsSigntool(
    'C:\\app.exe',
    {
      certificate: Buffer.from('pfx').toString('base64'),
      password: 'pw',
      timestampUrl: 'http://ts',
      description: undefined,
    },
    deps,
  );
  const call = calls[0];
  ok(call !== undefined);
  ok(!call.args.includes('/d'));
});

// ─── signWindowsTrustedSigning ────────────────────────────────────────────

test('signWindowsTrustedSigning: surfaces creds via env, never argv', async () => {
  const { exec, calls } = makeRecordingExec();
  const deps = makeDeps(exec);
  await signWindowsTrustedSigning(
    'C:\\app.exe',
    {
      tenantId: 'TENANT',
      clientId: 'CLIENT',
      clientSecret: 'SECRET',
      endpoint: 'https://eu.codesigning.azure.net',
      certProfile: 'profile-1',
      description: 'TinyApp',
    },
    deps,
  );
  strictEqual(calls.length, 1);
  const call = calls[0];
  ok(call !== undefined);
  strictEqual(call.command, 'azuresigntool');
  // Credentials are passed via env only — never as argv tokens.
  ok(!call.args.some((a) => a === 'SECRET'));
  ok(!call.args.some((a) => a === 'TENANT'));
  ok(!call.args.some((a) => a === 'CLIENT'));
  strictEqual(call.env?.['AZURE_TENANT_ID'], 'TENANT');
  strictEqual(call.env?.['AZURE_CLIENT_ID'], 'CLIENT');
  strictEqual(call.env?.['AZURE_CLIENT_SECRET'], 'SECRET');
  // Public args: endpoint + cert profile + description + binary.
  ok(call.args.includes('-kvu'));
  ok(call.args.includes('https://eu.codesigning.azure.net'));
  ok(call.args.includes('-kvc'));
  ok(call.args.includes('profile-1'));
  strictEqual(call.args[call.args.length - 1], 'C:\\app.exe');
});

test('signWindowsTrustedSigning: non-zero exit → SignError', async () => {
  const { exec } = makeRecordingExec([{ exitCode: 42, stderr: 'nope' }]);
  const deps = makeDeps(exec);
  await rejects(
    signWindowsTrustedSigning(
      'C:\\app.exe',
      {
        tenantId: 'T',
        clientId: 'C',
        clientSecret: 'S',
        endpoint: 'https://e',
        certProfile: 'p',
        description: undefined,
      },
      deps,
    ),
    SignError,
  );
});
