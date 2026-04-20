// Post-run cleanup. Removes this invocation's temp dir (recorded via
// core.saveState during the pre-step). Runs on success AND failure.

import * as core from '@actions/core';
import { rm } from 'node:fs/promises';

async function post(): Promise<void> {
  const invocationDir = core.getState('invocationDir');
  if (invocationDir !== '') {
    core.debug(`[pkg-action] cleaning invocation dir ${invocationDir}`);
    try {
      await rm(invocationDir, { recursive: true, force: true });
    } catch (err) {
      // Never fail a post step — surface as a warning so the job exit code
      // still reflects the real result of the main step.
      core.warning(`[pkg-action] post cleanup failed: ${String(err)}`);
    }
  }
}

post();
