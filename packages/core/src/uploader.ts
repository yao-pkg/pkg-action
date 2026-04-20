// Artifact upload + release attachment. Both collaborators are dependency-
// injected so tests don't need to hit @actions/artifact or the GitHub API.
//
// The production implementations wrap `@actions/artifact`'s DefaultArtifactClient
// and `@actions/github`'s Octokit respectively — see createDefaultUploader().

import { createReadStream } from 'node:fs';
import { basename } from 'node:path';
import { stat } from 'node:fs/promises';
import { UploadError } from './errors.ts';
import type { Logger } from './logger.ts';

// ─── DI-friendly shapes ───────────────────────────────────────────────────

export interface ArtifactUploadRequest {
  readonly name: string;
  readonly files: readonly string[];
  /** Parent directory used to compute entry paths inside the artifact. */
  readonly rootDirectory: string;
  readonly retentionDays?: number;
}

export interface ArtifactUploadResult {
  readonly artifactId: number | undefined;
  readonly size: number | undefined;
}

export interface ArtifactUploader {
  upload(req: ArtifactUploadRequest): Promise<ArtifactUploadResult>;
}

export interface ReleaseAsset {
  readonly path: string;
  readonly name: string;
  readonly contentType?: string;
}

export interface ReleaseAttachRequest {
  readonly owner: string;
  readonly repo: string;
  readonly tag: string;
  readonly assets: readonly ReleaseAsset[];
  /** Overwrite an existing asset with the same name. Default false. */
  readonly replace?: boolean;
}

export interface ReleaseAttachResult {
  /** Absolute URL to the release page. */
  readonly releaseUrl: string;
  readonly assetUrls: readonly string[];
}

export interface ReleaseAttacher {
  attach(req: ReleaseAttachRequest): Promise<ReleaseAttachResult>;
}

// ─── Orchestration helpers ────────────────────────────────────────────────

export interface UploadOrchestratorDeps {
  readonly artifact: ArtifactUploader;
  readonly logger: Logger;
}

/**
 * Upload one artifact per target. `@actions/artifact` v2 rejects duplicate
 * artifact names within a run, so callers must pass a unique `name` per call.
 */
export async function uploadArtifacts(
  requests: readonly ArtifactUploadRequest[],
  deps: UploadOrchestratorDeps,
): Promise<ArtifactUploadResult[]> {
  const results: ArtifactUploadResult[] = [];
  const seenNames = new Set<string>();
  for (const req of requests) {
    if (seenNames.has(req.name)) {
      throw new UploadError(
        `Artifact name "${req.name}" used more than once in the same run. ` +
          `Include a per-target token (e.g. {target}) in the artifact-name template.`,
      );
    }
    seenNames.add(req.name);
    deps.logger.info(
      `[pkg-action] Uploading artifact "${req.name}" (${String(req.files.length)} file${req.files.length === 1 ? '' : 's'})`,
    );
    try {
      const result = await deps.artifact.upload(req);
      results.push(result);
    } catch (err) {
      throw new UploadError(`Artifact upload failed for "${req.name}"`, { cause: err });
    }
  }
  return results;
}

// ─── Default wiring (production) ──────────────────────────────────────────

/**
 * Produce an `ArtifactUploader` backed by `@actions/artifact`. Imported lazily
 * so tests (and the `node --test` type-stripping runner) never transitively
 * load the real client.
 */
export async function createDefaultArtifactUploader(): Promise<ArtifactUploader> {
  // Dynamic import — keeps tests that don't exercise this path free of the dep.
  const mod = await import('@actions/artifact');
  const client = new mod.DefaultArtifactClient();
  return {
    async upload(req: ArtifactUploadRequest): Promise<ArtifactUploadResult> {
      const opts: { retentionDays?: number } = {};
      if (req.retentionDays !== undefined) opts.retentionDays = req.retentionDays;
      const response = await client.uploadArtifact(
        req.name,
        [...req.files],
        req.rootDirectory,
        opts,
      );
      return {
        artifactId: response.id,
        size: response.size,
      };
    },
  };
}

/**
 * Produce a `ReleaseAttacher` backed by `@actions/github`. Resolves the
 * release matching `tag` (or creates it with draft=true if missing when
 * `createIfMissing` is true), then uploads each asset via the Octokit REST API.
 */
export async function createDefaultReleaseAttacher(
  githubToken: string,
  opts: { createIfMissing?: boolean } = {},
): Promise<ReleaseAttacher> {
  const mod = await import('@actions/github');
  const octokit = mod.getOctokit(githubToken);

  return {
    async attach(req: ReleaseAttachRequest): Promise<ReleaseAttachResult> {
      // Find or create the release.
      let release: { id: number; html_url: string } | undefined;
      try {
        const found = await octokit.rest.repos.getReleaseByTag({
          owner: req.owner,
          repo: req.repo,
          tag: req.tag,
        });
        release = { id: found.data.id, html_url: found.data.html_url };
      } catch (err) {
        if (!isNotFound(err)) throw err;
        if (opts.createIfMissing !== true) {
          throw new UploadError(
            `No release tagged ${req.tag} in ${req.owner}/${req.repo}; pass createIfMissing: true to auto-create.`,
            { cause: err },
          );
        }
        const created = await octokit.rest.repos.createRelease({
          owner: req.owner,
          repo: req.repo,
          tag_name: req.tag,
          draft: true,
        });
        release = { id: created.data.id, html_url: created.data.html_url };
      }

      const assetUrls: string[] = [];
      for (const asset of req.assets) {
        if (req.replace === true) {
          await deleteExistingAsset(
            octokit as unknown as OctokitAssetOps,
            req.owner,
            req.repo,
            release.id,
            asset.name,
          );
        }
        const size = (await stat(asset.path)).size;
        const contentType = asset.contentType ?? guessContentType(asset.name);
        // Octokit's upload helper expects Buffer | string; we stream via a Buffer
        // readAll because the REST endpoint wants a complete content-length upfront.
        const data = await readAll(asset.path);
        const uploaded = await octokit.rest.repos.uploadReleaseAsset({
          owner: req.owner,
          repo: req.repo,
          release_id: release.id,
          name: asset.name,
          // @ts-expect-error — Octokit's typing expects string; binary Buffer is accepted at runtime.
          data,
          headers: {
            'content-type': contentType,
            'content-length': size,
          },
        });
        assetUrls.push(uploaded.data.browser_download_url);
      }

      return {
        releaseUrl: release.html_url,
        assetUrls,
      };
    },
  };
}

// ─── Internals ────────────────────────────────────────────────────────────

function isNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    (err as { status: unknown }).status === 404
  );
}

interface OctokitAssetOps {
  readonly rest: {
    readonly repos: {
      listReleaseAssets(args: {
        owner: string;
        repo: string;
        release_id: number;
        per_page: number;
      }): Promise<{ data: Array<{ id: number; name: string }> }>;
      deleteReleaseAsset(args: { owner: string; repo: string; asset_id: number }): Promise<unknown>;
    };
  };
}

async function deleteExistingAsset(
  octokit: OctokitAssetOps,
  owner: string,
  repo: string,
  releaseId: number,
  name: string,
): Promise<void> {
  const assets = await octokit.rest.repos.listReleaseAssets({
    owner,
    repo,
    release_id: releaseId,
    per_page: 100,
  });
  const existing = assets.data.find((a) => a.name === name);
  if (existing !== undefined) {
    await octokit.rest.repos.deleteReleaseAsset({
      owner,
      repo,
      asset_id: existing.id,
    });
  }
}

function guessContentType(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) return 'application/gzip';
  if (lower.endsWith('.tar.xz')) return 'application/x-xz';
  if (lower.endsWith('.zip')) return 'application/zip';
  if (lower.endsWith('.7z')) return 'application/x-7z-compressed';
  if (lower.endsWith('.exe')) return 'application/vnd.microsoft.portable-executable';
  if (
    lower.endsWith('.sha256') ||
    lower.endsWith('.sha512') ||
    lower.endsWith('.md5') ||
    lower.endsWith('.txt')
  ) {
    return 'text/plain';
  }
  return 'application/octet-stream';
}

async function readAll(path: string): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of createReadStream(path)) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks);
}

/**
 * Resolve owner/repo from the GH runner env. Uses GITHUB_REPOSITORY
 * ("owner/repo"); returns undefined when running locally.
 */
export function resolveRepoFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): { owner: string; repo: string } | undefined {
  const slug = env['GITHUB_REPOSITORY'];
  if (slug === undefined || slug === '') return undefined;
  const parts = slug.split('/');
  const owner = parts[0];
  const repo = parts[1];
  if (owner === undefined || repo === undefined || owner === '' || repo === '') return undefined;
  return { owner, repo };
}

/**
 * Extract the release tag from a ref like `refs/tags/v1.2.3`. Returns undefined
 * for non-tag refs (branches, PRs, manual dispatches).
 */
export function extractTagFromRef(ref: string | undefined): string | undefined {
  if (ref === undefined) return undefined;
  const prefix = 'refs/tags/';
  if (!ref.startsWith(prefix)) return undefined;
  const tag = ref.slice(prefix.length);
  return tag === '' ? undefined : tag;
}

/** Basename unused-export escape hatch — keeps the binding live against esbuild. */
export function artifactBasename(path: string): string {
  return basename(path);
}
