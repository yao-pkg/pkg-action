// Windows PE metadata — pure helpers.
//
// Stage 1 (M3.1): everything in this file is synchronous-except-for-I/O and
// touches no PE/resedit types. The resedit integration lands in M3.2 in a
// sibling module so unit tests here stay fast and deterministic.
//
// Parsers:
//   parseIconSpec(raw)          → IconSpec[]   (dedup by id)
//   padVersionQuad(raw)         → [n, n, n, n] (uint16 each, zero-padded)
//   mergeMetadataFile(env, file)→ WindowsMetadataInputs (explicit env wins)
//   parseWindowsMetadataInputs  → async; reads env + optional JSON file
//
// All parser failures surface as ValidationError so the orchestrator can
// report them via a single core.setFailed.

import { ValidationError } from './errors.ts';
import { readInputRaw, type EnvSource } from './inputs.ts';

// ─── Types ────────────────────────────────────────────────────────────────

export interface IconSpec {
  /** Icon-group resource id. Defaults to 1 when the user passes just a path. */
  readonly id: number;
  readonly path: string;
}

/**
 * Normalized Windows metadata — everything applyWindowsMetadata needs to
 * patch a .exe. `undefined` = "do not set / leave unchanged", empty array
 * for icons = "no icons to replace".
 */
export interface WindowsMetadataInputs {
  readonly icons: readonly IconSpec[];
  readonly productName: string | undefined;
  readonly productVersion: string | undefined;
  readonly fileVersion: string | undefined;
  readonly fileDescription: string | undefined;
  readonly companyName: string | undefined;
  readonly legalCopyright: string | undefined;
  readonly originalFilename: string | undefined;
  readonly internalName: string | undefined;
  readonly comments: string | undefined;
  readonly manifestPath: string | undefined;
  readonly lang: number;
  readonly codepage: number;
}

/** Partial/raw shape accepted from the JSON sidecar file. All fields optional. */
export interface WindowsMetadataFile {
  readonly icon?: string;
  readonly icons?: ReadonlyArray<IconSpec | string>;
  readonly productName?: string;
  readonly productVersion?: string;
  readonly fileVersion?: string;
  readonly fileDescription?: string;
  readonly companyName?: string;
  readonly legalCopyright?: string;
  readonly originalFilename?: string;
  readonly internalName?: string;
  readonly comments?: string;
  readonly manifest?: string;
  readonly lang?: number;
  readonly codepage?: number;
}

// ─── Icon-spec parser ─────────────────────────────────────────────────────

/** Parse the `windows-icon` input. Accepts:
 *    /path/to/foo.ico
 *    1=/a/foo.ico, 2=/a/bar.ico
 *    1=/a/foo.ico\n/a/bar.ico     (second entry falls back to id 1)
 *  Dedup by id — if the same id appears twice, the later wins (users
 *  typically override from a metadata-file). Empty input → []. */
export function parseIconSpec(raw: string): IconSpec[] {
  const pieces = raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const byId = new Map<number, IconSpec>();
  for (const piece of pieces) {
    const eq = piece.indexOf('=');
    let id: number;
    let path: string;
    if (eq === -1) {
      id = 1;
      path = piece;
    } else {
      const idRaw = piece.slice(0, eq);
      path = piece.slice(eq + 1).trim();
      if (!/^\d+$/.test(idRaw)) {
        throw new ValidationError(
          `windows-icon entry "${piece}" has invalid id "${idRaw}" — expected a positive integer before "=".`,
        );
      }
      id = Number(idRaw);
    }
    if (!Number.isInteger(id) || id < 1 || id > 0xffff) {
      throw new ValidationError(
        `windows-icon entry "${piece}" id ${String(id)} is out of range (1..65535).`,
      );
    }
    if (path === '') {
      throw new ValidationError(`windows-icon entry "${piece}" is missing a path.`);
    }
    byId.set(id, { id, path });
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

// ─── Version padder ───────────────────────────────────────────────────────

export type VersionQuad = readonly [number, number, number, number];

/** Parse a dotted version into a 4-tuple, padding with zeros. Each component
 *  must fit in a uint16 (0..65535) — that's what VS_FIXEDFILEINFO stores.
 *  Rejects anything that isn't purely `x(.y)?(.z)?(.w)?`. */
export function padVersionQuad(raw: string): VersionQuad {
  const trimmed = raw.trim();
  if (!/^\d+(?:\.\d+){0,3}$/.test(trimmed)) {
    throw new ValidationError(
      `Version "${raw}" must match x[.y[.z[.w]]] with each part being a non-negative integer.`,
    );
  }
  const parts = trimmed.split('.').map((p) => Number(p));
  for (const n of parts) {
    if (!Number.isInteger(n) || n < 0 || n > 0xffff) {
      throw new ValidationError(
        `Version "${raw}" has component ${String(n)} out of uint16 range (0..65535).`,
      );
    }
  }
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 0] as const;
}

// ─── Merge helpers ────────────────────────────────────────────────────────

/** Merge a metadata file under a set of env-derived inputs. Env always wins;
 *  each env field is passed as `undefined` when the user didn't set it, which
 *  lets the file fill the gap. Returns a fully-normalized shape. */
export function mergeMetadataFile(
  env: EnvWindowsMetadata,
  file: WindowsMetadataFile | undefined,
): WindowsMetadataInputs {
  const fileIcons = normalizeFileIcons(file);
  const icons = env.icons.length > 0 ? env.icons : fileIcons;

  const pick = (envValue: string | undefined, fileValue: string | undefined): string | undefined =>
    envValue ?? fileValue;

  const lang = env.lang ?? file?.lang ?? 1033;
  const codepage = env.codepage ?? file?.codepage ?? 1200;
  if (!Number.isInteger(lang) || lang < 0 || lang > 0xffff) {
    throw new ValidationError(`windows-lang must be a uint16, got ${String(lang)}.`);
  }
  if (!Number.isInteger(codepage) || codepage < 0 || codepage > 0xffff) {
    throw new ValidationError(`windows-codepage must be a uint16, got ${String(codepage)}.`);
  }

  return {
    icons,
    productName: pick(env.productName, file?.productName),
    productVersion: pick(env.productVersion, file?.productVersion),
    fileVersion: pick(env.fileVersion, file?.fileVersion),
    fileDescription: pick(env.fileDescription, file?.fileDescription),
    companyName: pick(env.companyName, file?.companyName),
    legalCopyright: pick(env.legalCopyright, file?.legalCopyright),
    originalFilename: pick(env.originalFilename, file?.originalFilename),
    internalName: pick(env.internalName, file?.internalName),
    comments: pick(env.comments, file?.comments),
    manifestPath: pick(env.manifestPath, file?.manifest),
    lang,
    codepage,
  };
}

/** Helper shape for the env half of mergeMetadataFile. Purely internal — but
 *  exported so tests can drive mergeMetadataFile directly without an env. */
export interface EnvWindowsMetadata {
  readonly icons: readonly IconSpec[];
  readonly productName: string | undefined;
  readonly productVersion: string | undefined;
  readonly fileVersion: string | undefined;
  readonly fileDescription: string | undefined;
  readonly companyName: string | undefined;
  readonly legalCopyright: string | undefined;
  readonly originalFilename: string | undefined;
  readonly internalName: string | undefined;
  readonly comments: string | undefined;
  readonly manifestPath: string | undefined;
  readonly lang: number | undefined;
  readonly codepage: number | undefined;
}

function normalizeFileIcons(file: WindowsMetadataFile | undefined): readonly IconSpec[] {
  if (file === undefined) return [];
  const out = new Map<number, IconSpec>();
  // Short-hand single icon.
  if (typeof file.icon === 'string' && file.icon.trim() !== '') {
    out.set(1, { id: 1, path: file.icon.trim() });
  }
  if (Array.isArray(file.icons)) {
    for (const entry of file.icons) {
      if (typeof entry === 'string') {
        const trimmed = entry.trim();
        if (trimmed === '') continue;
        out.set(1, { id: 1, path: trimmed });
        continue;
      }
      if (
        typeof entry === 'object' &&
        entry !== null &&
        typeof entry.id === 'number' &&
        typeof entry.path === 'string'
      ) {
        if (!Number.isInteger(entry.id) || entry.id < 1 || entry.id > 0xffff) {
          throw new ValidationError(
            `windows-metadata-file: icon id ${String(entry.id)} is out of range (1..65535).`,
          );
        }
        const path = entry.path.trim();
        if (path === '') {
          throw new ValidationError('windows-metadata-file: icon entry missing path.');
        }
        out.set(entry.id, { id: entry.id, path });
        continue;
      }
      throw new ValidationError(
        `windows-metadata-file: icons[] entry is neither a string nor {id, path}: ${JSON.stringify(entry)}.`,
      );
    }
  }
  return [...out.values()].sort((a, b) => a.id - b.id);
}

// ─── Top-level parser ─────────────────────────────────────────────────────

/** Minimal async fs.readFile shim — decouples the parser from node:fs. */
export type ReadFileFn = (path: string) => Promise<string>;

export interface ParseWindowsMetadataOptions {
  readonly env?: EnvSource;
  readonly readFile?: ReadFileFn;
}

/**
 * Parse all `windows-*` inputs into a WindowsMetadataInputs, or return null
 * when no windows-* input AND no windows-metadata-file is set. Returning null
 * lets the orchestrator skip the resedit step entirely on builds that aren't
 * metadata-branded.
 */
export async function parseWindowsMetadataInputs(
  opts: ParseWindowsMetadataOptions = {},
): Promise<WindowsMetadataInputs | null> {
  const env = opts.env ?? (process.env as EnvSource);
  const readFile =
    opts.readFile ??
    ((path: string) => import('node:fs/promises').then((m) => m.readFile(path, 'utf8')));

  const fileRaw = readInputRaw(env, 'windows-metadata-file');
  const iconRaw = readInputRaw(env, 'windows-icon');
  const productName = readInputRaw(env, 'windows-product-name');
  const productVersion = readInputRaw(env, 'windows-product-version');
  const fileVersion = readInputRaw(env, 'windows-file-version');
  const fileDescription = readInputRaw(env, 'windows-file-description');
  const companyName = readInputRaw(env, 'windows-company-name');
  const legalCopyright = readInputRaw(env, 'windows-legal-copyright');
  const originalFilename = readInputRaw(env, 'windows-original-filename');
  const internalName = readInputRaw(env, 'windows-internal-name');
  const comments = readInputRaw(env, 'windows-comments');
  const manifestPath = readInputRaw(env, 'windows-manifest');
  const langRaw = readInputRaw(env, 'windows-lang');
  const codepageRaw = readInputRaw(env, 'windows-codepage');

  const hasAnyField =
    fileRaw !== undefined ||
    iconRaw !== undefined ||
    productName !== undefined ||
    productVersion !== undefined ||
    fileVersion !== undefined ||
    fileDescription !== undefined ||
    companyName !== undefined ||
    legalCopyright !== undefined ||
    originalFilename !== undefined ||
    internalName !== undefined ||
    comments !== undefined ||
    manifestPath !== undefined;
  if (!hasAnyField) return null;

  let fileData: WindowsMetadataFile | undefined;
  if (fileRaw !== undefined) {
    let contents: string;
    try {
      contents = await readFile(fileRaw);
    } catch (err) {
      throw new ValidationError(`Failed to read windows-metadata-file "${fileRaw}".`, {
        cause: err,
      });
    }
    try {
      const parsed: unknown = JSON.parse(contents);
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new ValidationError(
          `windows-metadata-file "${fileRaw}" must contain a JSON object at the top level.`,
        );
      }
      fileData = parsed as WindowsMetadataFile;
    } catch (err) {
      if (err instanceof ValidationError) throw err;
      throw new ValidationError(
        `windows-metadata-file "${fileRaw}" is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const envIcons = iconRaw === undefined ? [] : parseIconSpec(iconRaw);

  const envBag: EnvWindowsMetadata = {
    icons: envIcons,
    productName,
    productVersion,
    fileVersion,
    fileDescription,
    companyName,
    legalCopyright,
    originalFilename,
    internalName,
    comments,
    manifestPath,
    lang: langRaw === undefined ? undefined : parseUint16(langRaw, 'windows-lang'),
    codepage: codepageRaw === undefined ? undefined : parseUint16(codepageRaw, 'windows-codepage'),
  };

  return mergeMetadataFile(envBag, fileData);
}

function parseUint16(raw: string, inputName: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 0xffff) {
    throw new ValidationError(`${inputName} must be a uint16 integer, got "${raw}".`);
  }
  return n;
}
