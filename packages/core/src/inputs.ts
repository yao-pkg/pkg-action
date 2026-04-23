// Hand-rolled input validator. Single source of truth for:
//   1. The typed `ActionInputs` value returned to the orchestrator
//   2. The metadata consumed by scripts/gen-action-yml.ts to produce action.yml
//      files and docs/inputs.md
//
// No zod, no ajv, no runtime schema library. Inputs are strings (they arrive
// as `INPUT_<NAME>` environment variables per the GH Actions runner protocol);
// coercion and mutual-exclusion checks live here and are 100% unit-tested.

import { ValidationError } from './errors.ts';
import { parseTargetList, type Target } from './targets.ts';
import { CHECKSUM_ALGORITHMS, type ChecksumAlgorithm } from './checksum.ts';

// ─── Metadata ─────────────────────────────────────────────────────────────

export type InputCategory = 'build' | 'post-build' | 'windows-metadata' | 'signing' | 'performance';

export interface InputSpec {
  readonly name: string;
  readonly category: InputCategory;
  readonly description: string;
  /** Default emitted into action.yml. Undefined = no default (input is optional unless required=true). */
  readonly default?: string;
  readonly required?: boolean;
  /** When true, the parser calls core.setSecret on the parsed value. */
  readonly secret?: boolean;
  /** When set, emit a deprecation message in the action.yml description. */
  readonly deprecated?: string;
}

// Registry. Used by codegen to produce action.yml. Kept exhaustive from day one
// so codegen doesn't need to know which milestone added which input.
export const INPUT_SPECS: readonly InputSpec[] = [
  // Build configuration (§5.1)
  {
    name: 'config',
    category: 'build',
    description:
      'Path to a pkg config (.pkgrc, pkg.config.{js,ts,json}, or package.json). Auto-detected when omitted.',
  },
  {
    name: 'entry',
    category: 'build',
    description: 'Entry script when not specified in the config.',
  },
  {
    name: 'targets',
    category: 'build',
    description:
      'Comma- or newline-separated pkg target triples, e.g. node22-linux-x64,node22-macos-arm64. Defaults to the host target.',
  },
  {
    name: 'mode',
    category: 'build',
    description: 'standard | sea — selects pkg Standard or SEA mode.',
    default: 'standard',
  },
  {
    name: 'node-version',
    category: 'build',
    description:
      "pkg's bundled Node.js major (e.g. 22, 24). Does not affect the action's own Node runtime.",
    default: '22',
  },
  {
    name: 'compress-node',
    category: 'build',
    description: "pkg's bundled-binary compression: Brotli | GZip | None.",
    default: 'None',
  },
  {
    name: 'fallback-to-source',
    category: 'build',
    description: 'Pass pkg --fallback-to-source for bytecode-fabricator failures.',
    default: 'false',
  },
  {
    name: 'public',
    category: 'build',
    description: 'Pass pkg --public (ships sources as plaintext).',
    default: 'false',
  },
  {
    name: 'public-packages',
    category: 'build',
    description: 'Comma-separated package names to mark public (pkg --public-packages).',
  },
  {
    name: 'options',
    category: 'build',
    description: 'Comma-separated V8 options baked into the binary (pkg --options).',
  },
  {
    name: 'no-bytecode',
    category: 'build',
    description: 'Pass pkg --no-bytecode.',
    default: 'false',
  },
  {
    name: 'no-dict',
    category: 'build',
    description: 'Comma-separated list of packages for pkg --no-dict (or * for all).',
  },
  { name: 'debug', category: 'build', description: 'Pass pkg --debug.', default: 'false' },
  {
    name: 'extra-args',
    category: 'build',
    description: 'Raw extra flags appended to the pkg CLI invocation.',
  },
  {
    name: 'pkg-version',
    category: 'build',
    description:
      'npm version specifier for @yao-pkg/pkg (e.g. ~6.16.0). Bypassed when pkg-path is set.',
    default: '~6.16.0',
  },
  {
    name: 'pkg-path',
    category: 'build',
    description: 'Absolute path to a pre-installed pkg binary. Skips the implicit npm i -g.',
  },

  // Post-build (§5.2)
  {
    name: 'strip',
    category: 'post-build',
    description: 'Strip debug symbols on Linux/macOS outputs.',
    default: 'false',
  },
  {
    name: 'compress',
    category: 'post-build',
    description: 'Archive format: tar.gz | tar.xz | zip | 7z | none.',
    default: 'none',
  },
  {
    name: 'filename',
    category: 'post-build',
    description:
      'Output filename template. Tokens: {name} {version} {target} {node} {os} {arch} {sha} {ref} {date} {tag}.',
    default: '{name}-{version}-{os}-{arch}',
  },
  {
    name: 'checksum',
    category: 'post-build',
    description: 'Checksum algorithms: comma list of none | sha256 | sha512 | md5.',
    default: 'sha256',
  },

  // Windows metadata (§5.3) — M3
  {
    name: 'windows-metadata-file',
    category: 'windows-metadata',
    description: 'Path to a JSON file with any subset of the Windows metadata fields.',
  },
  {
    name: 'windows-icon',
    category: 'windows-metadata',
    description:
      'Newline- or comma-separated list of <id>=<path> icon entries, or just <path> for id 1.',
  },
  {
    name: 'windows-product-name',
    category: 'windows-metadata',
    description: 'ProductName string.',
  },
  {
    name: 'windows-product-version',
    category: 'windows-metadata',
    description: 'ProductVersion (auto-padded to four parts).',
  },
  {
    name: 'windows-file-version',
    category: 'windows-metadata',
    description: 'FileVersion (auto-padded to four parts).',
  },
  {
    name: 'windows-file-description',
    category: 'windows-metadata',
    description: 'FileDescription string.',
  },
  {
    name: 'windows-company-name',
    category: 'windows-metadata',
    description: 'CompanyName string.',
  },
  {
    name: 'windows-legal-copyright',
    category: 'windows-metadata',
    description: 'LegalCopyright string (© auto-inserted if omitted).',
  },
  {
    name: 'windows-original-filename',
    category: 'windows-metadata',
    description: 'OriginalFilename string. Defaults to the output basename.',
  },
  {
    name: 'windows-internal-name',
    category: 'windows-metadata',
    description: 'InternalName string.',
  },
  { name: 'windows-comments', category: 'windows-metadata', description: 'Comments string.' },
  {
    name: 'windows-manifest',
    category: 'windows-metadata',
    description: 'Path to a raw app.manifest file to embed as RT_MANIFEST.',
  },
  {
    name: 'windows-lang',
    category: 'windows-metadata',
    description: 'Language identifier for VersionInfo.',
    default: '1033',
  },
  {
    name: 'windows-codepage',
    category: 'windows-metadata',
    description: 'Codepage for VersionInfo strings.',
    default: '1200',
  },

  // Signing & notarization (§5.4) — M4
  {
    name: 'macos-sign-identity',
    category: 'signing',
    description: 'codesign identity (Common Name or SHA-1).',
  },
  {
    name: 'macos-sign-certificate',
    category: 'signing',
    description: 'Base64-encoded .p12 certificate.',
    secret: true,
  },
  {
    name: 'macos-keychain-password',
    category: 'signing',
    description: 'Password for the ephemeral keychain holding the signing identity.',
    secret: true,
  },
  {
    name: 'macos-entitlements',
    category: 'signing',
    description: 'Path to an entitlements plist.',
  },
  {
    name: 'macos-notarize',
    category: 'signing',
    description: 'Run xcrun notarytool + staple after signing.',
    default: 'false',
  },
  {
    name: 'macos-apple-id',
    category: 'signing',
    description: 'Apple ID for notarytool.',
    secret: true,
  },
  {
    name: 'macos-team-id',
    category: 'signing',
    description: 'Apple Team ID for notarytool.',
    secret: true,
  },
  {
    name: 'macos-app-password',
    category: 'signing',
    description: 'App-specific password for notarytool.',
    secret: true,
  },
  {
    name: 'windows-sign-mode',
    category: 'signing',
    description: 'none | signtool | trusted-signing.',
    default: 'none',
  },
  {
    name: 'windows-sign-cert',
    category: 'signing',
    description: 'Base64-encoded .pfx for signtool mode.',
    secret: true,
  },
  {
    name: 'windows-sign-password',
    category: 'signing',
    description: 'Password for the .pfx.',
    secret: true,
  },
  {
    name: 'windows-sign-rfc3161-url',
    category: 'signing',
    description: 'RFC3161 timestamp URL for signtool.',
    default: 'http://timestamp.digicert.com',
  },
  {
    name: 'windows-sign-description',
    category: 'signing',
    description: 'Description passed to signtool /d.',
  },
  {
    name: 'azure-tenant-id',
    category: 'signing',
    description: 'Azure Trusted Signing: tenant ID.',
    secret: true,
  },
  {
    name: 'azure-client-id',
    category: 'signing',
    description: 'Azure Trusted Signing: client ID.',
    secret: true,
  },
  {
    name: 'azure-client-secret',
    category: 'signing',
    description: 'Azure Trusted Signing: client secret.',
    secret: true,
  },
  {
    name: 'azure-endpoint',
    category: 'signing',
    description: 'Azure Trusted Signing: endpoint URL.',
  },
  {
    name: 'azure-cert-profile',
    category: 'signing',
    description: 'Azure Trusted Signing: certificate profile name.',
  },

  // Performance / observability (§5.6)
  {
    name: 'cache',
    category: 'performance',
    description: 'Cache the pkg-fetch Node downloads between runs.',
    default: 'true',
  },
  {
    name: 'cache-key',
    category: 'performance',
    description: 'Override the auto-derived cache key.',
  },
  {
    name: 'step-summary',
    category: 'performance',
    description: 'Write a markdown summary of build time / size / checksum to the job summary.',
    default: 'true',
  },
];

/** Index for fast lookup; built once at module load. */
const SPEC_BY_NAME: ReadonlyMap<string, InputSpec> = new Map(
  INPUT_SPECS.map((s) => [s.name, s] as const),
);

export function specFor(name: string): InputSpec | undefined {
  return SPEC_BY_NAME.get(name);
}

// ─── Typed parsed inputs ──────────────────────────────────────────────────

export type CompressionMode = 'Brotli' | 'GZip' | 'None';
/** Archive format as seen by the input layer — extends archive.ts's set with 'none' (skip archiving). */
export type ArchiveFormatInput = 'tar.gz' | 'tar.xz' | 'zip' | '7z' | 'none';
export type PkgMode = 'standard' | 'sea';

/**
 * Parsed inputs — the M1-active subset. Later milestones extend this shape
 * with Windows/signing/publishing fields. We keep separate interfaces per
 * category so M3/M4 can add their own without perturbing the base.
 */
export interface BuildInputs {
  readonly config: string | undefined;
  readonly entry: string | undefined;
  /** 'host' = use the host target; otherwise a non-empty list. */
  readonly targets: Target[] | 'host';
  readonly mode: PkgMode;
  readonly nodeVersion: string;
  readonly compressNode: CompressionMode;
  readonly fallbackToSource: boolean;
  readonly public: boolean;
  readonly publicPackages: string[];
  readonly options: string[];
  readonly noBytecode: boolean;
  readonly noDict: string[];
  readonly debug: boolean;
  readonly extraArgs: string | undefined;
  readonly pkgVersion: string;
  readonly pkgPath: string | undefined;
}

export interface PostBuildInputs {
  readonly strip: boolean;
  readonly compress: ArchiveFormatInput;
  readonly filename: string;
  readonly checksum: ChecksumAlgorithm[]; // empty when 'none'
}

export interface PerformanceInputs {
  readonly cache: boolean;
  readonly cacheKey: string | undefined;
  readonly stepSummary: boolean;
}

export interface ActionInputs {
  readonly build: BuildInputs;
  readonly postBuild: PostBuildInputs;
  readonly performance: PerformanceInputs;
}

// ─── Parse helpers ────────────────────────────────────────────────────────

export type EnvSource = Readonly<Record<string, string | undefined>>;

/**
 * Read the raw string value of an input from the env source. Matches the GH
 * Actions runner contract as implemented by @actions/core: only SPACES are
 * replaced with underscores; dashes are preserved. So `windows-product-name`
 * becomes the literal env key `INPUT_WINDOWS-PRODUCT-NAME`.
 *
 * Trims surrounding whitespace and treats the empty string as unset.
 */
export function readInputRaw(env: EnvSource, name: string): string | undefined {
  const key = `INPUT_${name.replace(/ /g, '_').toUpperCase()}`;
  const raw = env[key];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Resolve with the input's default when unset. */
function readInput(env: EnvSource, name: string): string | undefined {
  const raw = readInputRaw(env, name);
  if (raw !== undefined) return raw;
  return specFor(name)?.default;
}

function parseBoolean(value: string | undefined, name: string): boolean {
  if (value === undefined) return false;
  const normalized = value.toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  throw new ValidationError(`Input "${name}" expected a boolean (true/false) but got "${value}".`);
}

function parseEnum<T extends string>(
  value: string | undefined,
  name: string,
  allowed: readonly T[],
): T {
  if (value === undefined) {
    throw new ValidationError(`Input "${name}" is required but not set.`);
  }
  if (!allowed.includes(value as T)) {
    throw new ValidationError(
      `Input "${name}" must be one of ${allowed.join(' | ')}, got "${value}".`,
    );
  }
  return value as T;
}

function parseList(value: string | undefined): string[] {
  if (value === undefined) return [];
  return value
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseChecksumList(value: string | undefined, name: string): ChecksumAlgorithm[] {
  const items = parseList(value);
  if (items.length === 0 || (items.length === 1 && items[0] === 'none')) return [];
  const result: ChecksumAlgorithm[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (item === 'none') {
      throw new ValidationError(`Input "${name}" cannot mix "none" with other algorithms.`);
    }
    if (!CHECKSUM_ALGORITHMS.includes(item as ChecksumAlgorithm)) {
      throw new ValidationError(
        `Input "${name}" contains unknown algorithm "${item}". Expected: ${CHECKSUM_ALGORITHMS.join(', ')}.`,
      );
    }
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item as ChecksumAlgorithm);
    }
  }
  return result;
}

// ─── parseInputs ──────────────────────────────────────────────────────────

export interface ParseInputsOptions {
  /** Defaults to process.env. Injectable for tests. */
  readonly env?: EnvSource;
  /**
   * Called for each input whose spec has secret=true AND a resolved value,
   * before any user value touches a log line. Pass `core.setSecret` in prod;
   * capture in tests.
   */
  readonly registerSecret?: (value: string) => void;
  /**
   * Called once per unknown INPUT_* environment variable so callers can emit
   * a warning with a Levenshtein hint. Argument is the kebab-case guess.
   */
  readonly onUnknownInput?: (name: string) => void;
}

export function parseInputs(opts: ParseInputsOptions = {}): ActionInputs {
  const env = opts.env ?? (process.env as EnvSource);

  // Register secrets BEFORE any parsing so a validation error message referencing
  // a value cannot leak it to logs.
  for (const spec of INPUT_SPECS) {
    if (spec.secret === true) {
      const raw = readInputRaw(env, spec.name);
      if (raw !== undefined) opts.registerSecret?.(raw);
    }
  }

  // Build
  const targetsRaw = readInput(env, 'targets');
  const targets: Target[] | 'host' =
    targetsRaw === undefined ? 'host' : parseTargetList(targetsRaw);
  if (Array.isArray(targets) && targets.length === 0) {
    throw new ValidationError(`Input "targets" was set but resolved to an empty list.`);
  }

  const build: BuildInputs = {
    config: readInput(env, 'config'),
    entry: readInput(env, 'entry'),
    targets,
    mode: parseEnum(readInput(env, 'mode'), 'mode', ['standard', 'sea'] as const),
    nodeVersion: readInput(env, 'node-version') ?? '22',
    compressNode: parseEnum(readInput(env, 'compress-node'), 'compress-node', [
      'Brotli',
      'GZip',
      'None',
    ] as const),
    fallbackToSource: parseBoolean(readInput(env, 'fallback-to-source'), 'fallback-to-source'),
    public: parseBoolean(readInput(env, 'public'), 'public'),
    publicPackages: parseList(readInput(env, 'public-packages')),
    options: parseList(readInput(env, 'options')),
    noBytecode: parseBoolean(readInput(env, 'no-bytecode'), 'no-bytecode'),
    noDict: parseList(readInput(env, 'no-dict')),
    debug: parseBoolean(readInput(env, 'debug'), 'debug'),
    extraArgs: readInput(env, 'extra-args'),
    pkgVersion: readInput(env, 'pkg-version') ?? '~6.16.0',
    pkgPath: readInput(env, 'pkg-path'),
  };

  // Post-build
  const postBuild: PostBuildInputs = {
    strip: parseBoolean(readInput(env, 'strip'), 'strip'),
    compress: parseEnum(readInput(env, 'compress'), 'compress', [
      'tar.gz',
      'tar.xz',
      'zip',
      '7z',
      'none',
    ] as const),
    filename: readInput(env, 'filename') ?? '{name}-{version}-{os}-{arch}',
    checksum: parseChecksumList(readInput(env, 'checksum'), 'checksum'),
  };

  // Performance / observability
  const performance: PerformanceInputs = {
    cache: parseBoolean(readInput(env, 'cache'), 'cache'),
    cacheKey: readInput(env, 'cache-key'),
    stepSummary: parseBoolean(readInput(env, 'step-summary'), 'step-summary'),
  };

  // Undeclared-input detector (plan §10). Scan env for INPUT_* keys without a
  // matching spec; emit a soft warning with a Levenshtein suggestion.
  if (opts.onUnknownInput !== undefined) {
    for (const key of Object.keys(env)) {
      if (!key.startsWith('INPUT_')) continue;
      // Reverse of readInputRaw: INPUT_<name-in-dashes-uppercase> → kebab-case.
      // @actions/core preserves dashes, so no _→- conversion is needed here.
      const kebab = key.slice('INPUT_'.length).toLowerCase();
      if (!SPEC_BY_NAME.has(kebab)) {
        opts.onUnknownInput(kebab);
      }
    }
  }

  return { build, postBuild, performance };
}

/**
 * Suggest the closest-matching declared input name for a typo.
 * Returns null when nothing is within 3 edits.
 */
export function closestInputName(input: string): string | null {
  let best: string | null = null;
  let bestDist = Infinity;
  for (const spec of INPUT_SPECS) {
    const d = levenshtein(input.toLowerCase(), spec.name);
    if (d < bestDist) {
      bestDist = d;
      best = spec.name;
    }
  }
  return bestDist <= 3 ? best : null;
}

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
