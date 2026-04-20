// Project metadata helpers. Read package.json for name/version and turn
// GITHUB_* env vars into the template tokens consumed by filename templates.
//
// Kept separate from inputs.ts because these values come from the project
// under test (package.json) and the runner env, not from user-supplied inputs.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ValidationError } from './errors.ts';
import { buildTokens, type TemplateTokens } from './templates.ts';
import type { Target } from './targets.ts';
import { formatTarget } from './targets.ts';

export interface ProjectInfo {
  /** package.json "name" (or "bin" basename if bin is a string). Used as the output base name. */
  readonly name: string;
  readonly version: string;
}

/**
 * Read and validate the project's package.json. Throws ValidationError when
 * the file is missing or lacks `name`/`version`.
 */
export async function readProjectInfo(projectDir: string): Promise<ProjectInfo> {
  const path = join(projectDir, 'package.json');
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch (err) {
    throw new ValidationError(`Cannot read package.json at ${path}`, { cause: err });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ValidationError(`Invalid JSON in ${path}`, { cause: err });
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new ValidationError(`package.json at ${path} is not an object.`);
  }
  const obj = parsed as Record<string, unknown>;
  const name = obj['name'];
  const version = obj['version'];
  if (typeof name !== 'string' || name === '') {
    throw new ValidationError(`package.json at ${path} is missing "name".`);
  }
  if (typeof version !== 'string' || version === '') {
    throw new ValidationError(`package.json at ${path} is missing "version".`);
  }
  return { name, version };
}

/**
 * Build the template-token record for a given target + project + runner env.
 * Merges project info, target triple parts, and GITHUB_* metadata.
 */
export function tokensForTarget(
  target: Target,
  project: ProjectInfo,
  env: Readonly<Record<string, string | undefined>>,
  nowDate: Date = new Date(),
): TemplateTokens {
  const sha = (env['GITHUB_SHA'] ?? '').slice(0, 7);
  const ref = env['GITHUB_REF_NAME'] ?? env['GITHUB_REF'] ?? '';
  const tag = extractTag(env['GITHUB_REF']);
  const nodePart = target.node === 'latest' ? 'latest' : `node${String(target.node)}`;

  return buildTokens({
    name: project.name,
    version: project.version,
    target: formatTarget(target),
    node: nodePart,
    os: target.os,
    arch: target.arch,
    sha,
    ref,
    date: nowDate,
    tag: tag ?? '',
  });
}

function extractTag(githubRef: string | undefined): string | undefined {
  if (githubRef === undefined) return undefined;
  const prefix = 'refs/tags/';
  if (!githubRef.startsWith(prefix)) return undefined;
  const tag = githubRef.slice(prefix.length);
  return tag === '' ? undefined : tag;
}
