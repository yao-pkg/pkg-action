import { test } from 'node:test';
import { deepStrictEqual, ok, strictEqual, throws } from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  archTag,
  buildDockerAuthsConfig,
  createDefaultDockerPublisher,
  extractRegistry,
  renderDockerfile,
  targetToDockerPlatform,
  type DockerPushTarget,
} from '../../src/docker.ts';
import { UploadError } from '../../src/errors.ts';
import type { ExecFn } from '../../src/pkg-runner.ts';
import type { Logger } from '../../src/logger.ts';

// ─── Pure helpers ─────────────────────────────────────────────────────────

test('renderDockerfile: minimal layout with FROM + COPY + ENTRYPOINT', () => {
  const body = renderDockerfile('my-app', 'gcr.io/distroless/base-debian12:latest');
  ok(body.includes('FROM gcr.io/distroless/base-debian12:latest'));
  ok(body.includes('COPY my-app /usr/local/bin/my-app'));
  ok(body.includes('ENTRYPOINT ["/usr/local/bin/my-app"]'));
});

test('renderDockerfile: rejects a binary name with whitespace', () => {
  throws(() => renderDockerfile('my app', 'scratch'), UploadError);
  throws(() => renderDockerfile('', 'scratch'), UploadError);
});

test('targetToDockerPlatform: maps pkg arch to docker arch', () => {
  strictEqual(targetToDockerPlatform({ os: 'linux', arch: 'x64' }), 'linux/amd64');
  strictEqual(targetToDockerPlatform({ os: 'linux', arch: 'arm64' }), 'linux/arm64');
  strictEqual(targetToDockerPlatform({ os: 'linux', arch: 'armv7' }), 'linux/arm/v7');
  strictEqual(targetToDockerPlatform({ os: 'linux', arch: 'armv6' }), 'linux/arm/v6');
  strictEqual(targetToDockerPlatform({ os: 'linuxstatic', arch: 'x64' }), 'linux/amd64');
  strictEqual(targetToDockerPlatform({ os: 'alpine', arch: 'arm64' }), 'linux/arm64');
});

test('targetToDockerPlatform: rejects non-linux os', () => {
  throws(() => targetToDockerPlatform({ os: 'macos', arch: 'arm64' }), UploadError);
  throws(() => targetToDockerPlatform({ os: 'win', arch: 'x64' }), UploadError);
});

test('targetToDockerPlatform: rejects unknown arch', () => {
  throws(() => targetToDockerPlatform({ os: 'linux', arch: 'i386' }), UploadError);
});

test('extractRegistry: extracts host from full ref', () => {
  strictEqual(extractRegistry('ghcr.io/org/app:1.0'), 'ghcr.io');
  strictEqual(extractRegistry('registry.example.com:5000/app'), 'registry.example.com:5000');
  strictEqual(extractRegistry('localhost/app'), 'localhost');
});

test('extractRegistry: falls back to docker.io for bare namespaces', () => {
  strictEqual(extractRegistry('library/nginx:latest'), 'docker.io');
  strictEqual(extractRegistry('nginx'), 'docker.io');
});

test('archTag: slashes in platform flatten to dashes', () => {
  strictEqual(archTag('ghcr.io/org/app:1.0', 'linux/amd64'), 'ghcr.io/org/app:1.0-amd64');
  strictEqual(archTag('ghcr.io/org/app:1.0', 'linux/arm/v7'), 'ghcr.io/org/app:1.0-arm-v7');
});

test('buildDockerAuthsConfig: base64-encodes user:password per registry', () => {
  const raw = buildDockerAuthsConfig('ghcr.io', 'user', 'pass');
  const parsed = JSON.parse(raw) as { auths: Record<string, { auth: string }> };
  strictEqual(parsed.auths['ghcr.io']?.auth, Buffer.from('user:pass', 'utf8').toString('base64'));
});

// ─── Publisher (argv + env shape) ─────────────────────────────────────────

interface ExecCall {
  readonly command: string;
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>> | undefined;
}

function fakeExec(): { exec: ExecFn; calls: ExecCall[] } {
  const calls: ExecCall[] = [];
  const exec: ExecFn = async (command, args, options) => {
    calls.push({ command, args: [...args], env: options.env });
    return { exitCode: 0, stdout: '', stderr: '' };
  };
  return { exec, calls };
}

const nullLogger: Logger = {
  debug: () => {},
  info: () => {},
  warning: () => {},
  error: () => {},
  notice: () => {},
  startGroup: () => {},
  endGroup: () => {},
  setSecret: () => {},
  isDebug: () => false,
};

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'docker-pub-'));
  return fn(dir);
}

async function stubBinary(dir: string, name: string): Promise<string> {
  const p = join(dir, name);
  await writeFile(p, '\x7fELFstub', { mode: 0o755 });
  return p;
}

async function linuxTarget(tempDir: string, arch: string): Promise<DockerPushTarget> {
  const binaryPath = await stubBinary(tempDir, `my-app-${arch}`);
  return { os: 'linux', arch, binaryPath, binaryName: 'my-app' };
}

test('docker publisher: writes a private DOCKER_CONFIG containing auth', async () => {
  await withTempDir(async (tempDir) => {
    const { exec } = fakeExec();
    const publisher = createDefaultDockerPublisher({ exec, logger: nullLogger });
    const target = await linuxTarget(tempDir, 'x64');
    await publisher.publish({
      image: 'ghcr.io/org/app:1.0',
      registry: 'ghcr.io',
      username: 'bot',
      password: 'secret-token',
      baseImage: 'scratch',
      dockerfile: undefined,
      targets: [target],
      tempDir,
      binaryName: 'my-app',
    });
    const cfg = JSON.parse(
      await readFile(join(tempDir, 'docker-config', 'config.json'), 'utf8'),
    ) as { auths: Record<string, { auth: string }> };
    strictEqual(
      cfg.auths['ghcr.io']?.auth,
      Buffer.from('bot:secret-token', 'utf8').toString('base64'),
    );
  });
});

test('docker publisher: argv never contains the password', async () => {
  await withTempDir(async (tempDir) => {
    const { exec, calls } = fakeExec();
    const publisher = createDefaultDockerPublisher({ exec, logger: nullLogger });
    const target = await linuxTarget(tempDir, 'x64');
    await publisher.publish({
      image: 'ghcr.io/org/app:1.0',
      registry: 'ghcr.io',
      username: 'bot',
      password: 'very-secret',
      baseImage: 'scratch',
      dockerfile: undefined,
      targets: [target],
      tempDir,
      binaryName: 'my-app',
    });
    const allArgs = calls.flatMap((c) => [c.command, ...c.args]);
    for (const token of allArgs) {
      ok(!token.includes('very-secret'), `argv must not leak the password: ${token}`);
    }
  });
});

test('docker publisher: single linux target emits build + push + retag', async () => {
  await withTempDir(async (tempDir) => {
    const { exec, calls } = fakeExec();
    const publisher = createDefaultDockerPublisher({ exec, logger: nullLogger });
    const target = await linuxTarget(tempDir, 'x64');
    await publisher.publish({
      image: 'ghcr.io/org/app:1.0',
      registry: 'ghcr.io',
      username: undefined,
      password: undefined,
      baseImage: 'scratch',
      dockerfile: undefined,
      targets: [target],
      tempDir,
      binaryName: 'my-app',
    });
    // First: buildx create --use (idempotent)
    strictEqual(calls[0]?.command, 'docker');
    deepStrictEqual(calls[0]?.args.slice(0, 3), ['buildx', 'create', '--name']);
    // Second: buildx build with --platform + --push + arch-suffixed tag
    const build = calls[1];
    ok(build !== undefined);
    deepStrictEqual(build.args.slice(0, 5), [
      'buildx',
      'build',
      '--platform',
      'linux/amd64',
      '--push',
    ]);
    const tagIdx = build.args.indexOf('-t');
    strictEqual(build.args[tagIdx + 1], 'ghcr.io/org/app:1.0-amd64');
    // Third: imagetools create to map arch-tag → canonical tag
    const manifest = calls[2];
    ok(manifest !== undefined);
    deepStrictEqual(manifest.args.slice(0, 4), ['buildx', 'imagetools', 'create', '--tag']);
    strictEqual(manifest.args[4], 'ghcr.io/org/app:1.0');
    strictEqual(manifest.args[5], 'ghcr.io/org/app:1.0-amd64');
  });
});

test('docker publisher: multi-arch emits per-arch build + manifest list', async () => {
  await withTempDir(async (tempDir) => {
    const { exec, calls } = fakeExec();
    const publisher = createDefaultDockerPublisher({ exec, logger: nullLogger });
    const x64 = await linuxTarget(tempDir, 'x64');
    const arm = await linuxTarget(tempDir, 'arm64');
    const result = await publisher.publish({
      image: 'ghcr.io/org/app:1.0',
      registry: 'ghcr.io',
      username: undefined,
      password: undefined,
      baseImage: 'scratch',
      dockerfile: undefined,
      targets: [x64, arm],
      tempDir,
      binaryName: 'my-app',
    });
    // create + 2 builds + manifest list = 4 exec calls
    strictEqual(calls.length, 4);
    ok(calls[1]?.args.includes('linux/amd64'));
    ok(calls[2]?.args.includes('linux/arm64'));
    const manifest = calls[3];
    deepStrictEqual(manifest?.args.slice(-3), [
      'ghcr.io/org/app:1.0',
      'ghcr.io/org/app:1.0-amd64',
      'ghcr.io/org/app:1.0-arm64',
    ]);
    strictEqual(result.manifestRef, 'ghcr.io/org/app:1.0');
    strictEqual(result.images.length, 3);
  });
});

test('docker publisher: DOCKER_CONFIG env is forwarded to every docker call', async () => {
  await withTempDir(async (tempDir) => {
    const { exec, calls } = fakeExec();
    const publisher = createDefaultDockerPublisher({ exec, logger: nullLogger });
    const target = await linuxTarget(tempDir, 'x64');
    await publisher.publish({
      image: 'ghcr.io/org/app:1.0',
      registry: 'ghcr.io',
      username: 'u',
      password: 'p',
      baseImage: 'scratch',
      dockerfile: undefined,
      targets: [target],
      tempDir,
      binaryName: 'my-app',
    });
    for (const c of calls) {
      strictEqual(c.env?.['DOCKER_CONFIG'], join(tempDir, 'docker-config'));
    }
  });
});

test('docker publisher: errors when targets list is empty', async () => {
  await withTempDir(async (tempDir) => {
    const { exec } = fakeExec();
    const publisher = createDefaultDockerPublisher({ exec, logger: nullLogger });
    try {
      await publisher.publish({
        image: 'ghcr.io/org/app:1.0',
        registry: 'ghcr.io',
        username: undefined,
        password: undefined,
        baseImage: 'scratch',
        dockerfile: undefined,
        targets: [],
        tempDir,
        binaryName: 'my-app',
      });
      ok(false, 'expected publish to throw');
    } catch (err) {
      ok(err instanceof UploadError);
    }
  });
});
