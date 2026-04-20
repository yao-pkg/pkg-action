// packages/matrix — matrix sub-action entry point.
//
// Reads three inputs, expands the `targets` list into a {target, runner}
// JSON array via @pkg-action/core's targets module, annotates known-risky
// cross-compile combinations, and emits the result on the `matrix` output
// so callers can plug it into `strategy.matrix`.
//
// Runs via `node24` → packages/matrix/dist/index.mjs produced by
// scripts/bundle.ts.

import * as core from '@actions/core';
import {
  crossCompileRisk,
  DEFAULT_RUNNER_LABELS,
  expandMatrix,
  formatErrorChain,
  parseTargetList,
  VERSION,
  ValidationError,
  type MatrixEntry,
  type Target,
  type TargetArch,
  type TargetOs,
} from '@pkg-action/core';

// Reverse index of DEFAULT_RUNNER_LABELS so we can recover an os/arch from
// a label the user has chosen. Several pkg os-arch pairs (linux-x64,
// linuxstatic-x64, alpine-x64) share the same ubuntu-latest runner; we keep
// the FIRST key that maps to a given label so the host reported back is the
// primary (kernel-level) os — which is what crossCompileRisk checks against.
const LABEL_TO_HOST: ReadonlyMap<string, { os: TargetOs; arch: TargetArch }> = (() => {
  const m = new Map<string, { os: TargetOs; arch: TargetArch }>();
  for (const [key, label] of Object.entries(DEFAULT_RUNNER_LABELS)) {
    if (m.has(label)) continue;
    const [os, arch] = key.split('-') as [TargetOs, TargetArch];
    m.set(label, { os, arch });
  }
  return m;
})();

export interface MatrixInputs {
  readonly targets: string;
  readonly allowCrossCompile: boolean;
  readonly runnerOverrides: Readonly<Record<string, string>>;
}

export interface MatrixRunDeps {
  readonly getInput: (name: string) => string;
  readonly getBooleanInput: (name: string) => boolean;
  readonly setOutput: (name: string, value: string) => void;
  readonly warning: (message: string) => void;
  readonly info: (message: string) => void;
  readonly setFailed: (message: string) => void;
}

export function parseRunnerOverrides(raw: string): Readonly<Record<string, string>> {
  const trimmed = raw.trim();
  if (trimmed === '') return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    throw new ValidationError(
      `runner-overrides is not valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ValidationError('runner-overrides must be a JSON object mapping triple → runner.');
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v !== 'string' || v.length === 0) {
      throw new ValidationError(`runner-overrides["${k}"] must be a non-empty string.`);
    }
    out[k] = v;
  }
  return out;
}

/** Infer a synthetic host Target from a GH-Actions runner label. Returns
 *  null when the label doesn't match any known GH-hosted label — self-
 *  hosted fleets fall into this bucket and we skip cross-compile analysis
 *  rather than guess. */
export function hostFromRunnerLabel(label: string, targetNode: Target['node']): Target | null {
  const hit = LABEL_TO_HOST.get(label);
  if (hit === undefined) return null;
  return { node: targetNode, os: hit.os, arch: hit.arch };
}

export function run(deps: MatrixRunDeps): void {
  const targetsRaw = deps.getInput('targets');
  if (targetsRaw.trim() === '') {
    deps.setFailed('targets input is required.');
    return;
  }

  let inputs: MatrixInputs;
  try {
    inputs = {
      targets: targetsRaw,
      allowCrossCompile: deps.getBooleanInput('allow-cross-compile'),
      runnerOverrides: parseRunnerOverrides(deps.getInput('runner-overrides')),
    };
  } catch (err) {
    deps.setFailed(formatErrorChain(err));
    return;
  }

  let targets: Target[];
  let entries: MatrixEntry[];
  try {
    targets = parseTargetList(inputs.targets);
    entries = expandMatrix(targets, inputs.runnerOverrides);
  } catch (err) {
    deps.setFailed(formatErrorChain(err));
    return;
  }

  if (entries.length === 0) {
    deps.setFailed('targets input produced an empty matrix.');
    return;
  }

  // Cross-compile warnings. We compare each target against a synthetic host
  // derived from the chosen runner label. Unknown labels (self-hosted) are
  // skipped so we never lecture users about their own fleet.
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i] as MatrixEntry;
    const target = targets[i] as Target;
    const host = hostFromRunnerLabel(entry.runner, target.node);
    if (host === null) continue;
    const risk = crossCompileRisk(host, target);
    if (risk === null) continue;
    const msg = `[${entry.target} → ${entry.runner}] ${risk}`;
    if (inputs.allowCrossCompile) {
      deps.info(`cross-compile (allowed): ${msg}`);
    } else {
      deps.warning(msg);
    }
  }

  deps.info(
    `pkg-action matrix v${VERSION} — ${String(entries.length)} entr${entries.length === 1 ? 'y' : 'ies'}`,
  );
  deps.setOutput('matrix', JSON.stringify(entries));
}

/* c8 ignore start */
if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  try {
    run({
      getInput: (name) => core.getInput(name),
      getBooleanInput: (name) => {
        // Mirror @actions/core's getBooleanInput semantics but tolerate a blank
        // value (the action.yml default supplies 'false' — blank means the
        // caller omitted the input AND the default was wiped).
        const raw = core.getInput(name);
        if (raw === '') return false;
        return core.getBooleanInput(name);
      },
      setOutput: (name, value) => core.setOutput(name, value),
      warning: (m) => core.warning(m),
      info: (m) => core.info(m),
      setFailed: (m) => core.setFailed(m),
    });
  } catch (err) {
    core.setFailed(formatErrorChain(err));
  }
}
/* c8 ignore stop */
