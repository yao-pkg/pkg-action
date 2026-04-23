// Signing & notarization — macOS codesign/notarytool + Windows signtool +
// Azure Trusted Signing. Every external tool is invoked through the
// existing ExecFn DI so unit tests can verify the argv shape without a
// real cert ever touching the runner.
//
// Inputs are grouped into three sub-bags because the paths diverge
// sharply — macOS wants a keychain round-trip, Windows signtool wants a
// decoded .pfx on disk, Azure Trusted Signing is env-only. Callers
// dispatch on target.os + inputs.signing.windowsMode.

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { SignError, ValidationError } from './errors.ts';
import { readInputRaw, type EnvSource } from './inputs.ts';
import type { Logger } from './logger.ts';
import type { ExecFn } from './pkg-runner.ts';

// ─── Types ────────────────────────────────────────────────────────────────

export interface MacosSigningInputs {
  readonly identity: string;
  /** Base64-encoded .p12. Already passed through core.setSecret. */
  readonly certificate: string;
  readonly keychainPassword: string;
  readonly entitlements: string | undefined;
  readonly notarize: boolean;
  readonly appleId: string | undefined;
  readonly teamId: string | undefined;
  readonly appPassword: string | undefined;
}

export type WindowsSignMode = 'none' | 'signtool' | 'trusted-signing';

export interface WindowsSigntoolInputs {
  readonly certificate: string; // base64 .pfx
  readonly password: string;
  readonly timestampUrl: string;
  readonly description: string | undefined;
}

export interface WindowsTrustedSigningInputs {
  readonly tenantId: string;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly endpoint: string;
  readonly certProfile: string;
  readonly description: string | undefined;
}

export interface SigningInputs {
  readonly macos: MacosSigningInputs | undefined;
  readonly windowsMode: WindowsSignMode;
  readonly windowsSigntool: WindowsSigntoolInputs | undefined;
  readonly windowsTrusted: WindowsTrustedSigningInputs | undefined;
}

// ─── Parser ───────────────────────────────────────────────────────────────

export interface ParseSigningInputsOptions {
  readonly env?: EnvSource;
  readonly registerSecret?: (value: string) => void;
}

/**
 * Parse signing inputs from env. Returns null only when NO signing
 * configuration is present — macOS inputs absent and Windows mode is
 * 'none'. All secret-marked fields are routed through registerSecret
 * before any validation message can reference them.
 */
export function parseSigningInputs(opts: ParseSigningInputsOptions = {}): SigningInputs | null {
  const env = opts.env ?? (process.env as EnvSource);
  const registerSecret = opts.registerSecret ?? ((): void => {});

  // macOS
  const macosIdentity = readInputRaw(env, 'macos-sign-identity');
  const macosCert = readInputRaw(env, 'macos-sign-certificate');
  const macosKeychainPw = readInputRaw(env, 'macos-keychain-password');
  const macosEntitlements = readInputRaw(env, 'macos-entitlements');
  const macosNotarize = parseBool(readInputRaw(env, 'macos-notarize'), 'macos-notarize', false);
  const macosAppleId = readInputRaw(env, 'macos-apple-id');
  const macosTeamId = readInputRaw(env, 'macos-team-id');
  const macosAppPw = readInputRaw(env, 'macos-app-password');
  if (macosCert !== undefined) registerSecret(macosCert);
  if (macosKeychainPw !== undefined) registerSecret(macosKeychainPw);
  if (macosAppleId !== undefined) registerSecret(macosAppleId);
  if (macosTeamId !== undefined) registerSecret(macosTeamId);
  if (macosAppPw !== undefined) registerSecret(macosAppPw);

  let macos: MacosSigningInputs | undefined;
  const macosAnything =
    macosIdentity !== undefined || macosCert !== undefined || macosKeychainPw !== undefined;
  if (macosAnything) {
    if (macosIdentity === undefined || macosCert === undefined || macosKeychainPw === undefined) {
      throw new ValidationError(
        'macOS signing requires all of macos-sign-identity, macos-sign-certificate, macos-keychain-password.',
      );
    }
    if (macosNotarize) {
      if (macosAppleId === undefined || macosTeamId === undefined || macosAppPw === undefined) {
        throw new ValidationError(
          'macos-notarize=true requires macos-apple-id, macos-team-id, macos-app-password.',
        );
      }
    }
    macos = {
      identity: macosIdentity,
      certificate: macosCert,
      keychainPassword: macosKeychainPw,
      entitlements: macosEntitlements,
      notarize: macosNotarize,
      appleId: macosAppleId,
      teamId: macosTeamId,
      appPassword: macosAppPw,
    };
  }

  // Windows
  const windowsMode = parseWindowsSignMode(readInputRaw(env, 'windows-sign-mode') ?? 'none');
  const signtoolCert = readInputRaw(env, 'windows-sign-cert');
  const signtoolPw = readInputRaw(env, 'windows-sign-password');
  const signtoolTimestamp =
    readInputRaw(env, 'windows-sign-rfc3161-url') ?? 'http://timestamp.digicert.com';
  const signDescription = readInputRaw(env, 'windows-sign-description');
  const azureTenant = readInputRaw(env, 'azure-tenant-id');
  const azureClient = readInputRaw(env, 'azure-client-id');
  const azureSecret = readInputRaw(env, 'azure-client-secret');
  const azureEndpoint = readInputRaw(env, 'azure-endpoint');
  const azureProfile = readInputRaw(env, 'azure-cert-profile');
  if (signtoolCert !== undefined) registerSecret(signtoolCert);
  if (signtoolPw !== undefined) registerSecret(signtoolPw);
  if (azureTenant !== undefined) registerSecret(azureTenant);
  if (azureClient !== undefined) registerSecret(azureClient);
  if (azureSecret !== undefined) registerSecret(azureSecret);

  let windowsSigntool: WindowsSigntoolInputs | undefined;
  let windowsTrusted: WindowsTrustedSigningInputs | undefined;

  if (windowsMode === 'signtool') {
    if (signtoolCert === undefined || signtoolPw === undefined) {
      throw new ValidationError(
        'windows-sign-mode=signtool requires windows-sign-cert and windows-sign-password.',
      );
    }
    if (azureTenant !== undefined || azureClient !== undefined || azureEndpoint !== undefined) {
      throw new ValidationError(
        'windows-sign-mode=signtool cannot be combined with azure-* inputs. Set windows-sign-mode=trusted-signing instead.',
      );
    }
    windowsSigntool = {
      certificate: signtoolCert,
      password: signtoolPw,
      timestampUrl: signtoolTimestamp,
      description: signDescription,
    };
  } else if (windowsMode === 'trusted-signing') {
    if (
      azureTenant === undefined ||
      azureClient === undefined ||
      azureSecret === undefined ||
      azureEndpoint === undefined ||
      azureProfile === undefined
    ) {
      throw new ValidationError(
        'windows-sign-mode=trusted-signing requires all of azure-tenant-id, azure-client-id, azure-client-secret, azure-endpoint, azure-cert-profile.',
      );
    }
    if (signtoolCert !== undefined || signtoolPw !== undefined) {
      throw new ValidationError(
        'windows-sign-mode=trusted-signing cannot be combined with windows-sign-cert/password.',
      );
    }
    windowsTrusted = {
      tenantId: azureTenant,
      clientId: azureClient,
      clientSecret: azureSecret,
      endpoint: azureEndpoint,
      certProfile: azureProfile,
      description: signDescription,
    };
  }

  if (macos === undefined && windowsMode === 'none') return null;
  return { macos, windowsMode, windowsSigntool, windowsTrusted };
}

function parseBool(value: string | undefined, name: string, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const v = value.toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  throw new ValidationError(`Input "${name}" expected a boolean, got "${value}".`);
}

function parseWindowsSignMode(raw: string): WindowsSignMode {
  if (raw === 'none' || raw === 'signtool' || raw === 'trusted-signing') return raw;
  throw new ValidationError(
    `windows-sign-mode must be one of: none | signtool | trusted-signing. Got "${raw}".`,
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────

export interface SigningDeps {
  readonly exec: ExecFn;
  readonly logger: Logger;
  /** Absolute path where secret material may be written temporarily. */
  readonly tempDir: string;
  /** Override for Node fs — tests stub with in-memory writes. */
  readonly writeFile?: (path: string, data: Uint8Array) => Promise<void>;
}

async function runCheckedTool(
  deps: SigningDeps,
  command: string,
  args: readonly string[],
  label: string,
  opts: { env?: Readonly<Record<string, string>> } = {},
): Promise<void> {
  deps.logger.info(`[pkg-action] ${label}: ${command} ${args.join(' ')}`);
  const result = await deps.exec(command, args, {
    ignoreReturnCode: true,
    ...(opts.env !== undefined ? { env: opts.env } : {}),
  });
  if (result.exitCode !== 0) {
    throw new SignError(`${label} failed (exit ${String(result.exitCode)}). See stderr above.`);
  }
}

/** Decode a base64 payload to disk with a random filename. Callers must
 *  delete the path after use — we return it so the caller can plug into
 *  saveState for post.ts cleanup. */
async function writeSecretBase64(
  deps: SigningDeps,
  tempDir: string,
  base64: string,
  extension: string,
): Promise<string> {
  const path = join(tempDir, `${randomBytes(8).toString('hex')}.${extension}`);
  const bytes = Buffer.from(base64, 'base64');
  const writer = deps.writeFile ?? ((p: string, d: Uint8Array) => writeFile(p, d, { mode: 0o600 }));
  await writer(path, bytes);
  return path;
}

// ─── macOS ────────────────────────────────────────────────────────────────

/** Record of side-effects the macOS driver created that post.ts must tear
 *  down. Currently just the ephemeral keychain path. */
export interface MacosSigningCleanup {
  readonly keychainPath: string;
}

export async function signMacos(
  binaryPath: string,
  cfg: MacosSigningInputs,
  deps: SigningDeps,
): Promise<MacosSigningCleanup> {
  const keychainPath = join(
    deps.tempDir,
    `pkg-action-${randomBytes(6).toString('hex')}.keychain-db`,
  );
  const p12Path = await writeSecretBase64(deps, deps.tempDir, cfg.certificate, 'p12');

  // Create + unlock ephemeral keychain, import cert, allow codesign access.
  await runCheckedTool(
    deps,
    'security',
    ['create-keychain', '-p', cfg.keychainPassword, keychainPath],
    'security create-keychain',
  );
  await runCheckedTool(
    deps,
    'security',
    ['set-keychain-settings', '-lut', '21600', keychainPath],
    'security set-keychain-settings',
  );
  await runCheckedTool(
    deps,
    'security',
    ['unlock-keychain', '-p', cfg.keychainPassword, keychainPath],
    'security unlock-keychain',
  );
  await runCheckedTool(
    deps,
    'security',
    [
      'import',
      p12Path,
      '-k',
      keychainPath,
      '-P',
      cfg.keychainPassword,
      '-T',
      '/usr/bin/codesign',
      '-T',
      '/usr/bin/security',
    ],
    'security import',
  );
  await runCheckedTool(
    deps,
    'security',
    [
      'set-key-partition-list',
      '-S',
      'apple-tool:,apple:,codesign:',
      '-s',
      '-k',
      cfg.keychainPassword,
      keychainPath,
    ],
    'security set-key-partition-list',
  );

  // codesign. --force replaces existing sigs (pkg ships unsigned);
  // --options runtime enables the hardened runtime notarization demands.
  const codesignArgs = [
    '--force',
    '--timestamp',
    '--options',
    'runtime',
    '--keychain',
    keychainPath,
    '--sign',
    cfg.identity,
  ];
  if (cfg.entitlements !== undefined) {
    codesignArgs.push('--entitlements', cfg.entitlements);
  }
  codesignArgs.push(binaryPath);
  await runCheckedTool(deps, 'codesign', codesignArgs, 'codesign');

  // Post-sign sanity: re-invoke codesign in verify mode to confirm the
  // signature actually landed. Catches bad identities, revoked certs, and
  // silent signtool/codesign failures that still exit 0.
  await runCheckedTool(
    deps,
    'codesign',
    ['--verify', '--strict', '--verbose=2', binaryPath],
    'codesign --verify',
  );

  if (cfg.notarize) {
    // notarytool only needs the three secrets — appleId/teamId/appPassword.
    // Validated up front in parseSigningInputs.
    await runCheckedTool(
      deps,
      'xcrun',
      [
        'notarytool',
        'submit',
        binaryPath,
        '--apple-id',
        cfg.appleId as string,
        '--team-id',
        cfg.teamId as string,
        '--password',
        cfg.appPassword as string,
        '--wait',
      ],
      'xcrun notarytool submit',
    );
    // Binaries (unlike .app bundles) cannot be stapled — only container
    // formats accept the notarization ticket. We still submit, which
    // registers the binary with Apple's Gatekeeper service; downstream
    // archive/upload stays untouched.
    deps.logger.info(
      '[pkg-action] notarytool submit succeeded. Note: bare binaries cannot be stapled; Gatekeeper queries Apple at first launch.',
    );
  }

  return { keychainPath };
}

// ─── Windows signtool ─────────────────────────────────────────────────────

export async function signWindowsSigntool(
  binaryPath: string,
  cfg: WindowsSigntoolInputs,
  deps: SigningDeps,
): Promise<void> {
  const pfxPath = await writeSecretBase64(deps, deps.tempDir, cfg.certificate, 'pfx');
  const args = [
    'sign',
    '/fd',
    'sha256',
    '/td',
    'sha256',
    '/tr',
    cfg.timestampUrl,
    '/f',
    pfxPath,
    '/p',
    cfg.password,
  ];
  if (cfg.description !== undefined) args.push('/d', cfg.description);
  args.push(binaryPath);
  await runCheckedTool(deps, 'signtool', args, 'signtool sign');
  // Post-sign sanity: verify the signature embedded in the PE. `/pa` uses
  // the default Authenticode chain policy; `/v` is verbose.
  await runCheckedTool(deps, 'signtool', ['verify', '/pa', '/v', binaryPath], 'signtool verify');
}

// ─── Azure Trusted Signing ────────────────────────────────────────────────

export async function signWindowsTrustedSigning(
  binaryPath: string,
  cfg: WindowsTrustedSigningInputs,
  deps: SigningDeps,
): Promise<void> {
  // azuresigntool reads AZURE_* env vars for auth. We could pass them as
  // argv, but env is the documented path and keeps them out of ps/argv
  // dumps. Every secret must already have been registered with
  // core.setSecret during input parse.
  const env: Record<string, string> = {
    AZURE_TENANT_ID: cfg.tenantId,
    AZURE_CLIENT_ID: cfg.clientId,
    AZURE_CLIENT_SECRET: cfg.clientSecret,
  };
  const args = [
    'sign',
    '-kvu',
    cfg.endpoint,
    '-kvc',
    cfg.certProfile,
    '-tr',
    'http://timestamp.acs.microsoft.com',
    '-td',
    'sha256',
    '-fd',
    'sha256',
  ];
  if (cfg.description !== undefined) args.push('-d', cfg.description);
  args.push(binaryPath);
  await runCheckedTool(deps, 'azuresigntool', args, 'azuresigntool sign', { env });
  // azuresigntool produces a standard Authenticode signature, so the same
  // signtool verify path applies. No azure creds required to verify.
  await runCheckedTool(deps, 'signtool', ['verify', '/pa', '/v', binaryPath], 'signtool verify');
}
