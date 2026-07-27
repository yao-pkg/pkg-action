// Spawn the @yao-pkg/pkg CLI and stream its output to the GH Actions log.
// Collaborators are dependency-injected (`ExecFn`, `Logger`) so tests can
// swap in fakes without module mocking.

import type { Logger } from './logger.ts';
import type { BuildInputs } from './inputs.ts';
import { formatTarget, type Target } from './targets.ts';
import { PkgRunError } from './errors.ts';

/** Minimal shape of @actions/exec.getExecOutput that we depend on. */
export interface ExecOptions {
  readonly cwd?: string;
  readonly env?: Readonly<Record<string, string>>;
  /** When true, non-zero exit codes must NOT throw; the caller inspects result. */
  readonly ignoreReturnCode?: boolean;
}

export interface ExecResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

export type ExecFn = (
  command: string,
  args: readonly string[],
  options: ExecOptions,
) => Promise<ExecResult>;

export interface PkgRunnerDeps {
  readonly exec: ExecFn;
  readonly logger: Logger;
  /** Path to the pkg executable or the name of a globally-installed one. */
  readonly pkgCommand: string;
}

export interface PkgInvocation {
  readonly build: BuildInputs;
  /** Resolved targets — callers upgrade `'host'` to an explicit host target first. */
  readonly targets: readonly Target[];
  readonly outputDir: string;
  /** cwd for the pkg process; defaults to process.cwd(). */
  readonly cwd?: string;
  /** Extra env merged onto the child process env. */
  readonly env?: Readonly<Record<string, string>>;
}

/**
 * Build the argv passed to pkg from a `PkgInvocation`. Exposed for unit tests.
 *
 * The action deliberately owns only a thin action-layer surface: targets (CI
 * matrix concern), config path, output directory, entry. Pkg-specific knobs
 * (mode, compression, public, bytecode, v8 options, debug, …) belong in the
 * user's pkg config file so the action doesn't have to track pkg's CLI.
 */
export function buildPkgArgs(inv: PkgInvocation): string[] {
  const args: string[] = [];

  if (inv.targets.length > 0) {
    args.push('--targets', inv.targets.map(formatTarget).join(','));
  }
  if (inv.build.config !== undefined) {
    args.push('--config', inv.build.config);
  }

  args.push('--out-path', inv.outputDir);

  // Positional entry / project root — must come LAST, after flags.
  const entry = inv.build.entry ?? '.';
  args.push(entry);

  return args;
}

/**
 * `npm i -g @yao-pkg/pkg@<specifier>`.
 *
 * Callers skip this when `pkg-path` names a pre-installed binary. The specifier
 * was already shape-checked by `parseInputs`, and it lands in a single argv
 * element, so nothing here can turn it into a second npm flag.
 */
export async function installPkg(
  specifier: string,
  deps: Omit<PkgRunnerDeps, 'pkgCommand'>,
): Promise<void> {
  const spec = `@yao-pkg/pkg@${specifier}`;
  deps.logger.info(`[pkg-action] Installing ${spec}`);
  let result: ExecResult;
  try {
    result = await deps.exec('npm', ['i', '-g', spec], { ignoreReturnCode: true });
  } catch (err) {
    throw new PkgRunError(`Failed to spawn npm: ${String(err)}`, { cause: err });
  }
  if (result.exitCode !== 0) {
    throw new PkgRunError(`npm i -g ${spec} exited ${String(result.exitCode)}.`);
  }
}

/**
 * Ask pkg which version it actually is. The `pkg-version` input is a specifier
 * (`~6.21.0` floats patches), so it can't identify the build that ran — which is
 * what you need when a patch release regresses. Returns undefined rather than
 * throwing: failing to label a summary must never fail a build.
 */
export async function resolvePkgVersion(deps: PkgRunnerDeps): Promise<string | undefined> {
  try {
    const result = await deps.exec(deps.pkgCommand, ['--version'], { ignoreReturnCode: true });
    if (result.exitCode !== 0) return undefined;
    const version = result.stdout.trim();
    return version === '' ? undefined : version;
  } catch {
    return undefined;
  }
}

/**
 * Run pkg with the given invocation. Wraps non-zero exits in PkgRunError so
 * the orchestrator can surface the failure as a single `core.setFailed`.
 */
export async function runPkg(inv: PkgInvocation, deps: PkgRunnerDeps): Promise<ExecResult> {
  const args = buildPkgArgs(inv);
  deps.logger.info(`[pkg-action] Invoking: ${deps.pkgCommand} ${args.join(' ')}`);

  let result: ExecResult;
  try {
    result = await deps.exec(deps.pkgCommand, args, {
      ignoreReturnCode: true,
      ...(inv.cwd !== undefined ? { cwd: inv.cwd } : {}),
      ...(inv.env !== undefined ? { env: inv.env } : {}),
    });
  } catch (err) {
    throw new PkgRunError(`Failed to spawn pkg: ${String(err)}`, { cause: err });
  }

  if (result.exitCode !== 0) {
    // Name the config: a preBuild/postBuild/transform hook failing looks exactly
    // like a pkg-internal failure in the log, and the hook lives in that file.
    const configHint =
      inv.build.config !== undefined
        ? ` If a preBuild/postBuild/transform hook is set in ${inv.build.config}, check its output above — hook failures surface as a pkg exit.`
        : '';
    throw new PkgRunError(
      `pkg exited with code ${String(result.exitCode)}. See stderr above.${configHint}`,
    );
  }

  return result;
}
