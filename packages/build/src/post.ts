// Post-run cleanup.
//   - Removes this invocation's temp dir (recorded via saveState in main).
//   - Deletes every ephemeral macOS keychain the signer created.
//
// Post steps must never fail the job — anything going wrong here surfaces
// as a warning so the run's exit code still reflects the main step.

import * as core from '@actions/core';
import { getExecOutput } from '@actions/exec';
import { rm } from 'node:fs/promises';

async function tearDownKeychains(): Promise<void> {
  const raw = core.getState('macosKeychains');
  if (raw === '') return;
  for (const path of raw.split('\n').filter((s) => s.length > 0)) {
    try {
      core.debug(`[pkg-action] deleting keychain ${path}`);
      const result = await getExecOutput('security', ['delete-keychain', path], {
        ignoreReturnCode: true,
      });
      if (result.exitCode !== 0) {
        core.warning(`[pkg-action] security delete-keychain ${path} exited ${result.exitCode}.`);
      }
    } catch (err) {
      core.warning(`[pkg-action] keychain teardown for ${path} failed: ${String(err)}`);
    }
  }
}

async function post(): Promise<void> {
  await tearDownKeychains();

  const invocationDir = core.getState('invocationDir');
  if (invocationDir !== '') {
    core.debug(`[pkg-action] cleaning invocation dir ${invocationDir}`);
    try {
      await rm(invocationDir, { recursive: true, force: true });
    } catch (err) {
      core.warning(`[pkg-action] post cleanup failed: ${String(err)}`);
    }
  }
}

post();
