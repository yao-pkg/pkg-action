// Downstream-distribution publishers: Homebrew tap + Scoop bucket (M6.4 / M6.5).
//
// Both channels share the same shape — "open a PR against a downstream repo
// with an updated manifest file". The wire-level Octokit plumbing is identical
// to release-attach; the per-channel bits are the file path, the rendered body,
// and the commit message.
//
// Renderers are pure so they are fully unit-tested. The publisher is a DI-able
// interface so the orchestrator never touches Octokit in tests.

import { UploadError } from './errors.ts';

// ─── Shared asset shape ───────────────────────────────────────────────────

export interface DistAsset {
  /** macOS/Windows/Linux, etc. — drives cpu/platform branching inside the manifest. */
  readonly os: 'macos' | 'win' | 'linux' | 'linuxstatic' | 'alpine';
  /** x64 | arm64 | armv7 | … */
  readonly arch: string;
  /** Release download URL, fully qualified. */
  readonly url: string;
  /** Hex-encoded SHA-256 of the downloaded file. */
  readonly sha256: string;
  /** Archive name as it appears in the release (e.g. `my-app-1.0.0-macos-arm64.tar.gz`). */
  readonly assetName: string;
  /** Directory inside the archive (Scoop needs this for extract_dir). Empty when none. */
  readonly extractDir: string;
}

export interface HomebrewFormulaInput {
  /** Class name in PascalCase (e.g. `MyApp`). Derived from formula name when omitted. */
  readonly className?: string;
  /** Formula filename without .rb (kebab-case). */
  readonly formulaName: string;
  readonly description: string;
  readonly homepage: string;
  readonly version: string;
  readonly license: string | undefined;
  /** Must include at least one macos-* asset; linux-* assets are used opportunistically. */
  readonly assets: readonly DistAsset[];
  /** Executable name the formula links into $prefix/bin (defaults to formulaName). */
  readonly binary?: string;
}

export interface ScoopManifestInput {
  readonly manifestName: string;
  readonly description: string;
  readonly homepage: string;
  readonly version: string;
  readonly license: string | undefined;
  /** Must include at least one win-* asset. */
  readonly assets: readonly DistAsset[];
  /** Executable filename inside the extracted archive (defaults to `<manifestName>.exe`). */
  readonly binary?: string;
}

// ─── Renderers ────────────────────────────────────────────────────────────

/** Render a Homebrew formula `.rb` file body. */
export function renderHomebrewFormula(input: HomebrewFormulaInput): string {
  const cls = input.className ?? toPascalCase(input.formulaName);
  const mac = byOsArch(input.assets, 'macos');
  const linux = byOsArch(input.assets, 'linux');
  if (mac.length === 0 && linux.length === 0) {
    throw new UploadError('Homebrew formula requires at least one macOS or Linux asset.');
  }
  const binaryName = input.binary ?? input.formulaName;
  const lines: string[] = [];
  lines.push(`class ${cls} < Formula`);
  lines.push(`  desc "${escapeRuby(input.description)}"`);
  lines.push(`  homepage "${escapeRuby(input.homepage)}"`);
  lines.push(`  version "${escapeRuby(input.version)}"`);
  if (input.license !== undefined && input.license !== '') {
    lines.push(`  license "${escapeRuby(input.license)}"`);
  }
  if (mac.length > 0) {
    lines.push(`  on_macos do`);
    emitArchBlocks(lines, mac, 4);
    lines.push(`  end`);
  }
  if (linux.length > 0) {
    lines.push(`  on_linux do`);
    emitArchBlocks(lines, linux, 4);
    lines.push(`  end`);
  }
  lines.push(``);
  lines.push(`  def install`);
  lines.push(`    bin.install "${escapeRuby(binaryName)}"`);
  lines.push(`  end`);
  lines.push(``);
  lines.push(`  test do`);
  lines.push(
    `    assert_match version.to_s, shell_output("#{bin}/${escapeRuby(binaryName)} --version")`,
  );
  lines.push(`  end`);
  lines.push(`end`);
  return lines.join('\n') + '\n';
}

function emitArchBlocks(lines: string[], assets: readonly DistAsset[], indent: number): void {
  const pad = ' '.repeat(indent);
  for (const asset of assets) {
    const cond = asset.arch === 'arm64' ? 'on_arm' : 'on_intel';
    lines.push(`${pad}${cond} do`);
    lines.push(`${pad}  url "${escapeRuby(asset.url)}"`);
    lines.push(`${pad}  sha256 "${escapeRuby(asset.sha256)}"`);
    lines.push(`${pad}end`);
  }
}

/** Render a Scoop manifest JSON body. */
export function renderScoopManifest(input: ScoopManifestInput): string {
  const winAssets = byOsArch(input.assets, 'win');
  if (winAssets.length === 0) {
    throw new UploadError('Scoop manifest requires at least one Windows asset.');
  }
  const binary = input.binary ?? `${input.manifestName}.exe`;
  const architecture: Record<string, unknown> = {};
  for (const asset of winAssets) {
    const key = asset.arch === 'arm64' ? 'arm64' : '64bit';
    const entry: Record<string, unknown> = {
      url: asset.url,
      hash: `sha256:${asset.sha256}`,
      bin: binary,
    };
    if (asset.extractDir !== '') entry['extract_dir'] = asset.extractDir;
    architecture[key] = entry;
  }
  const doc: Record<string, unknown> = {
    version: input.version,
    description: input.description,
    homepage: input.homepage,
    ...(input.license !== undefined && input.license !== '' ? { license: input.license } : {}),
    architecture,
  };
  return JSON.stringify(doc, null, 2) + '\n';
}

function byOsArch(assets: readonly DistAsset[], os: DistAsset['os']): DistAsset[] {
  return assets.filter((a) => a.os === os);
}

function toPascalCase(s: string): string {
  return s
    .split(/[^A-Za-z0-9]+/)
    .filter((p) => p.length > 0)
    .map((p) => p[0]!.toUpperCase() + p.slice(1).toLowerCase())
    .join('');
}

function escapeRuby(s: string): string {
  // Ruby double-quoted strings interpolate #{…} and escape-processes \. Both must be quoted.
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/#\{/g, '\\#{');
}

// ─── Publisher DI interface ───────────────────────────────────────────────

export interface PublishRequest {
  readonly owner: string;
  readonly repo: string;
  /** Branch to commit on. Created from the repo's default branch if missing. */
  readonly branch: string;
  /** Path of the manifest inside the repo (e.g. `Formula/my-app.rb`). */
  readonly path: string;
  /** File body. */
  readonly content: string;
  readonly commitMessage: string;
  /** PR to open. Skipped when undefined. */
  readonly pullRequest?: {
    readonly title: string;
    readonly body: string;
    /** Base branch for the PR; defaults to the repo's default branch. */
    readonly base?: string;
  };
}

export interface PublishResult {
  readonly commitSha: string;
  readonly pullRequestUrl: string | undefined;
}

export interface DistributionPublisher {
  publish(req: PublishRequest): Promise<PublishResult>;
}

// ─── Default Octokit wiring ───────────────────────────────────────────────

/** Factory for the production publisher. Dynamic import of @actions/github keeps
 *  tests free of the dep. */
export async function createDefaultDistributionPublisher(
  githubToken: string,
): Promise<DistributionPublisher> {
  const mod = await import('@actions/github');
  const octokit = mod.getOctokit(githubToken);
  return {
    async publish(req: PublishRequest): Promise<PublishResult> {
      // 1. Resolve default branch (used as base when PR base is unset).
      const repoInfo = await octokit.rest.repos.get({ owner: req.owner, repo: req.repo });
      const defaultBranch = repoInfo.data.default_branch;

      // 2. Ensure the head branch exists. Either it already does (fetch its SHA)
      //    or we create it off the default branch.
      let headSha: string;
      try {
        const ref = await octokit.rest.git.getRef({
          owner: req.owner,
          repo: req.repo,
          ref: `heads/${req.branch}`,
        });
        headSha = ref.data.object.sha;
      } catch (err) {
        if (!isNotFound(err)) {
          throw new UploadError(`Failed to inspect branch ${req.branch}`, { cause: err });
        }
        const defaultRef = await octokit.rest.git.getRef({
          owner: req.owner,
          repo: req.repo,
          ref: `heads/${defaultBranch}`,
        });
        const created = await octokit.rest.git.createRef({
          owner: req.owner,
          repo: req.repo,
          ref: `refs/heads/${req.branch}`,
          sha: defaultRef.data.object.sha,
        });
        headSha = created.data.object.sha;
      }

      // 3. Fetch existing content SHA (if any) so the PUT is an update rather
      //    than a create collision.
      let existingSha: string | undefined;
      try {
        const existing = await octokit.rest.repos.getContent({
          owner: req.owner,
          repo: req.repo,
          path: req.path,
          ref: req.branch,
        });
        if (!Array.isArray(existing.data) && 'sha' in existing.data) {
          existingSha = existing.data.sha;
        }
      } catch (err) {
        if (!isNotFound(err)) {
          throw new UploadError(`Failed to inspect ${req.path}`, { cause: err });
        }
      }

      // 4. Commit the file.
      const putArgs: Record<string, unknown> = {
        owner: req.owner,
        repo: req.repo,
        path: req.path,
        branch: req.branch,
        message: req.commitMessage,
        content: Buffer.from(req.content, 'utf8').toString('base64'),
      };
      if (existingSha !== undefined) putArgs['sha'] = existingSha;
      const putResponse = (await (
        octokit as unknown as {
          rest: {
            repos: {
              createOrUpdateFileContents: (args: Record<string, unknown>) => Promise<{
                data: { commit: { sha: string } };
              }>;
            };
          };
        }
      ).rest.repos.createOrUpdateFileContents(putArgs)) as { data: { commit: { sha: string } } };
      const commitSha = putResponse.data.commit.sha;

      // 5. PR (optional).
      let pullRequestUrl: string | undefined;
      if (req.pullRequest !== undefined) {
        const base = req.pullRequest.base ?? defaultBranch;
        const existingPr = await octokit.rest.pulls.list({
          owner: req.owner,
          repo: req.repo,
          head: `${req.owner}:${req.branch}`,
          state: 'open',
          per_page: 1,
        });
        if (existingPr.data.length > 0) {
          pullRequestUrl = existingPr.data[0]!.html_url;
        } else {
          const created = await octokit.rest.pulls.create({
            owner: req.owner,
            repo: req.repo,
            head: req.branch,
            base,
            title: req.pullRequest.title,
            body: req.pullRequest.body,
          });
          pullRequestUrl = created.data.html_url;
        }
      }
      // Don't reference headSha beyond here; the commit we just made may or may
      // not advance past it, and the caller only cares about the write SHA.
      void headSha;
      return { commitSha, pullRequestUrl };
    },
  };
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    (err as { status: unknown }).status === 404
  );
}

// ─── Orchestrator helpers ─────────────────────────────────────────────────

export function buildReleaseAssetUrl(
  owner: string,
  repo: string,
  tag: string,
  assetName: string,
): string {
  return `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(assetName)}`;
}
