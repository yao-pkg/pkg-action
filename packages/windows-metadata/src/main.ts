// packages/windows-metadata — sub-action entry point.
//
// Standalone Node24 JS action: reads an input .exe, layers metadata via
// @pkg-action/core's applyWindowsMetadata, writes the patched binary, and
// emits its path on the `output-path` output.
//
// The input schema uses BARE names (icon, product-name, …) — the top-
// level composite uses the same fields prefixed with `windows-*`. Both
// schemas go through parseWindowsMetadataInputs via the prefix option.

import * as core from '@actions/core';
import {
  applyWindowsMetadata,
  formatErrorChain,
  parseWindowsMetadataInputs,
  VERSION,
  type WindowsMetadataInputs,
} from '@pkg-action/core';

export interface WindowsMetadataRunDeps {
  readonly getInput: (name: string) => string;
  readonly setOutput: (name: string, value: string) => void;
  readonly info: (message: string) => void;
  readonly setFailed: (message: string) => void;
  /** Invoked with the parsed inputs. Swapped for the real resedit path in prod
   *  and for a no-op double in tests. */
  readonly apply: (
    inputPath: string,
    outputPath: string,
    meta: WindowsMetadataInputs,
  ) => Promise<void>;
}

export async function run(deps: WindowsMetadataRunDeps): Promise<void> {
  const inputPath = deps.getInput('input').trim();
  if (inputPath === '') {
    deps.setFailed('input is required.');
    return;
  }
  const outputRaw = deps.getInput('output').trim();
  const outputPath = outputRaw === '' ? inputPath : outputRaw;

  let meta: WindowsMetadataInputs | null;
  try {
    meta = await parseWindowsMetadataInputs({ prefix: '' });
  } catch (err) {
    deps.setFailed(formatErrorChain(err));
    return;
  }

  if (meta === null) {
    // Nothing to patch — a copy-through would be surprising, so fail loudly
    // so users notice the sub-action ran as a no-op by mistake.
    deps.setFailed(
      'windows-metadata was invoked with no metadata fields set. Pass at least one of icon, product-name, file-version, … or metadata-file.',
    );
    return;
  }

  try {
    await deps.apply(inputPath, outputPath, meta);
  } catch (err) {
    deps.setFailed(formatErrorChain(err));
    return;
  }

  deps.info(`pkg-action windows-metadata v${VERSION} — patched ${outputPath}`);
  deps.setOutput('output-path', outputPath);
}

/* c8 ignore start */
if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  run({
    getInput: (name) => core.getInput(name),
    setOutput: (name, value) => core.setOutput(name, value),
    info: (m) => core.info(m),
    setFailed: (m) => core.setFailed(m),
    apply: applyWindowsMetadata,
  }).catch((err: unknown) => {
    core.setFailed(formatErrorChain(err));
  });
}
/* c8 ignore stop */
