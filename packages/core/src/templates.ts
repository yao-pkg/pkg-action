// Filename / artifact-name token engine. Used to produce deterministic
// output names from a template like `{name}-{version}-{os}-{arch}`.
//
// Token list is closed: unknown tokens are a hard error so typos in inputs
// surface at parse time, not at archive time.

import { ValidationError } from './errors.ts';

export interface TemplateTokens {
  readonly name: string;
  readonly version: string;
  readonly target: string;
  readonly node: string; // 'node22', 'node24', or the literal 'latest'
  readonly os: string; // 'linux' | 'macos' | 'win' | ...
  readonly arch: string; // 'x64' | 'arm64' | ...
  readonly sha: string; // short commit SHA, 7 chars
  readonly ref: string; // GITHUB_REF_NAME or '' if unset
  readonly date: string; // YYYYMMDD UTC
  readonly tag: string; // release tag (same as ref when on a tag), '' otherwise
}

export const TEMPLATE_TOKEN_NAMES: readonly (keyof TemplateTokens)[] = [
  'name',
  'version',
  'target',
  'node',
  'os',
  'arch',
  'sha',
  'ref',
  'date',
  'tag',
];

const TOKEN_RE = /\{([a-zA-Z]+)\}/g;

/**
 * Substitute tokens in `template` using `tokens`. Unknown tokens throw
 * ValidationError with a Levenshtein suggestion.
 */
export function render(template: string, tokens: TemplateTokens): string {
  return template.replace(TOKEN_RE, (full, name: string) => {
    if (!TEMPLATE_TOKEN_NAMES.includes(name as keyof TemplateTokens)) {
      const suggestion = closestToken(name);
      const hint = suggestion !== null ? ` Did you mean "{${suggestion}}"?` : '';
      throw new ValidationError(`Unknown template token "${full}".${hint}`);
    }
    const value = tokens[name as keyof TemplateTokens];
    if (value === undefined) {
      throw new ValidationError(`Template token "${full}" is undefined.`);
    }
    return value;
  });
}

/**
 * Suggest the closest-matching known token name by Levenshtein distance.
 * Returns null if nothing is within 3 edits.
 */
export function closestToken(input: string): keyof TemplateTokens | null {
  let best: keyof TemplateTokens | null = null;
  let bestDist = Infinity;
  for (const candidate of TEMPLATE_TOKEN_NAMES) {
    const d = levenshtein(input.toLowerCase(), candidate);
    if (d < bestDist) {
      bestDist = d;
      best = candidate;
    }
  }
  return bestDist <= 3 ? best : null;
}

/** Canonical iterative Levenshtein. O(n·m), fine for token-list size. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = new Array<number>(b.length + 1);
  let curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j += 1) prev[j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min((curr[j - 1] ?? 0) + 1, (prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length] ?? 0;
}

/**
 * Build the default tokens object from common inputs. Callers can override
 * individual fields (e.g. `sha`) before passing to `render`.
 */
export function buildTokens(args: {
  name: string;
  version: string;
  target: string;
  node: string;
  os: string;
  arch: string;
  sha?: string;
  ref?: string;
  date?: Date;
  tag?: string;
}): TemplateTokens {
  const d = args.date ?? new Date();
  const yyyymmdd = [
    d.getUTCFullYear().toString().padStart(4, '0'),
    (d.getUTCMonth() + 1).toString().padStart(2, '0'),
    d.getUTCDate().toString().padStart(2, '0'),
  ].join('');
  return {
    name: args.name,
    version: args.version,
    target: args.target,
    node: args.node,
    os: args.os,
    arch: args.arch,
    sha: args.sha ?? '',
    ref: args.ref ?? '',
    date: yyyymmdd,
    tag: args.tag ?? '',
  };
}
