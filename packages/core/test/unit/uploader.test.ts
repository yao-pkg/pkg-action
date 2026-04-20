import { test } from 'node:test';
import { strictEqual, deepStrictEqual, ok, rejects } from 'node:assert/strict';
import {
  extractTagFromRef,
  resolveRepoFromEnv,
  uploadArtifacts,
  type ArtifactUploadRequest,
  type ArtifactUploadResult,
  type ArtifactUploader,
} from '../../src/uploader.ts';
import { createTestLogger } from '../../src/logger.ts';
import { UploadError } from '../../src/errors.ts';

function fakeUploader(handler?: (req: ArtifactUploadRequest) => Promise<ArtifactUploadResult>): {
  uploader: ArtifactUploader;
  calls: ArtifactUploadRequest[];
} {
  const calls: ArtifactUploadRequest[] = [];
  const uploader: ArtifactUploader = {
    async upload(req) {
      calls.push(req);
      if (handler !== undefined) return handler(req);
      return { artifactId: 42, size: 1000 };
    },
  };
  return { uploader, calls };
}

test('uploadArtifacts fans out each request to the uploader in order', async () => {
  const { uploader, calls } = fakeUploader();
  const { logger } = createTestLogger();
  const result = await uploadArtifacts(
    [
      { name: 'a-linux', files: ['/tmp/a.tar.gz'], rootDirectory: '/tmp' },
      { name: 'a-macos', files: ['/tmp/b.zip'], rootDirectory: '/tmp' },
    ],
    { artifact: uploader, logger },
  );
  strictEqual(result.length, 2);
  strictEqual(calls.length, 2);
  strictEqual(calls[0]?.name, 'a-linux');
  strictEqual(calls[1]?.name, 'a-macos');
});

test('uploadArtifacts rejects duplicate artifact names', async () => {
  const { uploader } = fakeUploader();
  const { logger } = createTestLogger();
  await rejects(
    uploadArtifacts(
      [
        { name: 'same', files: ['/a'], rootDirectory: '/tmp' },
        { name: 'same', files: ['/b'], rootDirectory: '/tmp' },
      ],
      { artifact: uploader, logger },
    ),
    (err) => err instanceof UploadError && err.message.includes('more than once'),
  );
});

test('uploadArtifacts wraps client failures in UploadError with cause', async () => {
  const cause = new Error('network boom');
  const uploader: ArtifactUploader = {
    async upload() {
      throw cause;
    },
  };
  const { logger } = createTestLogger();
  await rejects(
    uploadArtifacts([{ name: 'x', files: ['/a'], rootDirectory: '/tmp' }], {
      artifact: uploader,
      logger,
    }),
    (err) => err instanceof UploadError && (err as { cause?: unknown }).cause === cause,
  );
});

test('uploadArtifacts logs one line per artifact', async () => {
  const { uploader } = fakeUploader();
  const { logger, calls } = createTestLogger();
  await uploadArtifacts(
    [
      { name: 'a', files: ['/a.zip'], rootDirectory: '/tmp' },
      { name: 'b', files: ['/b.zip', '/b.sha256'], rootDirectory: '/tmp' },
    ],
    { artifact: uploader, logger },
  );
  const info = calls.filter((c) => c.level === 'info');
  strictEqual(info.length, 2);
  ok(info[0]?.message.includes('"a"'));
  ok(info[0]?.message.includes('1 file'));
  ok(info[1]?.message.includes('"b"'));
  ok(info[1]?.message.includes('2 files'));
});

test('resolveRepoFromEnv parses GITHUB_REPOSITORY', () => {
  deepStrictEqual(resolveRepoFromEnv({ GITHUB_REPOSITORY: 'yao-pkg/pkg-action' }), {
    owner: 'yao-pkg',
    repo: 'pkg-action',
  });
});

test('resolveRepoFromEnv returns undefined for missing or malformed slug', () => {
  strictEqual(resolveRepoFromEnv({}), undefined);
  strictEqual(resolveRepoFromEnv({ GITHUB_REPOSITORY: '' }), undefined);
  strictEqual(resolveRepoFromEnv({ GITHUB_REPOSITORY: 'no-slash' }), undefined);
  strictEqual(resolveRepoFromEnv({ GITHUB_REPOSITORY: '/empty-owner' }), undefined);
});

test('extractTagFromRef returns tag for refs/tags/*', () => {
  strictEqual(extractTagFromRef('refs/tags/v1.2.3'), 'v1.2.3');
  strictEqual(extractTagFromRef('refs/tags/release-2026-04-18'), 'release-2026-04-18');
});

test('extractTagFromRef returns undefined for non-tag refs', () => {
  strictEqual(extractTagFromRef(undefined), undefined);
  strictEqual(extractTagFromRef('refs/heads/main'), undefined);
  strictEqual(extractTagFromRef('refs/pull/42/merge'), undefined);
  strictEqual(extractTagFromRef('refs/tags/'), undefined);
});
