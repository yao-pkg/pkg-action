// Typed error hierarchy. All errors thrown from @pkg-action/core extend PkgActionError
// so callers (packages/build/src/main.ts) can convert them into a single core.setFailed
// without leaking internal details. `cause` is native ES2022 — we chain originals
// into it instead of stringifying.

export interface PkgActionErrorOpts {
  cause?: unknown;
  /** If set, emits a GitHub annotation with this file as the source. */
  file?: string;
  line?: number;
  col?: number;
}

export class PkgActionError extends Error {
  public readonly file?: string;
  public readonly line?: number;
  public readonly col?: number;

  public constructor(message: string, opts: PkgActionErrorOpts = {}) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = new.target.name;
    if (opts.file !== undefined) this.file = opts.file;
    if (opts.line !== undefined) this.line = opts.line;
    if (opts.col !== undefined) this.col = opts.col;
  }
}

/** Input failed validation (mutex rules, unknown value, missing required). */
export class ValidationError extends PkgActionError {}

/** `pkg` CLI invocation failed. */
export class PkgRunError extends PkgActionError {}

/** Subprocess for tar/7z/strip/codesign/signtool failed. */
export class ToolError extends PkgActionError {}

/** Archive read/write/integrity issue. */
export class ArchiveError extends PkgActionError {}

/** Checksum computation or write failure. */
export class ChecksumError extends PkgActionError {}

/** Windows resedit / metadata injection failure. */
export class ResEditError extends PkgActionError {}

/** macOS codesign / notarytool failure. */
export class SignError extends PkgActionError {}

/** Artifact upload or release attachment failed. */
export class UploadError extends PkgActionError {}

/**
 * Render a chain of causes as a single human-readable string.
 * Walks `.cause` up to `maxDepth` levels, tagging each with its class name.
 */
export function formatErrorChain(err: unknown, maxDepth = 5): string {
  const parts: string[] = [];
  let current: unknown = err;
  let depth = 0;
  while (current !== undefined && current !== null && depth < maxDepth) {
    if (current instanceof Error) {
      parts.push(`${current.name}: ${current.message}`);
      current = (current as { cause?: unknown }).cause;
    } else {
      parts.push(String(current));
      break;
    }
    depth += 1;
  }
  return parts.join(' → caused by → ');
}
