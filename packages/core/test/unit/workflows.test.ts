// Workflow YAML is only validated by GitHub, at which point a mistake costs a
// push and a red run that names no file. These are the checks worth having
// locally.

import { test } from 'node:test';
import { ok } from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORKFLOW_DIR = fileURLToPath(new URL('../../../../.github/workflows', import.meta.url));

async function workflows(): Promise<Array<{ name: string; text: string }>> {
  const files = (await readdir(WORKFLOW_DIR)).filter((f) => f.endsWith('.yml'));
  return Promise.all(
    files.map(async (name) => ({ name, text: await readFile(join(WORKFLOW_DIR, name), 'utf8') })),
  );
}

// `uses:` is not in the context-availability table — GitHub rejects the whole
// workflow file with "this run likely failed because of a workflow file issue"
// and no annotation pointing at the line. Cost one CI round-trip already.
test('no step uses an expression in its uses: key', async () => {
  for (const { name, text } of await workflows()) {
    for (const [i, line] of text.split('\n').entries()) {
      if (!/^\s*(?:-\s*)?uses:/.test(line)) continue;
      ok(
        !line.includes('${{'),
        `${name}:${String(i + 1)} — uses: takes no expressions: ${line.trim()}`,
      );
    }
  }
});

test('every workflow pins actions to a major tag or a sha, never a branch', async () => {
  for (const { name, text } of await workflows()) {
    for (const [i, line] of text.split('\n').entries()) {
      const m = /^\s*(?:-\s*)?uses:\s*([^\s#]+)/.exec(line);
      const ref = m?.[1];
      if (ref === undefined || ref.startsWith('./')) continue;
      // The e2e canary deliberately downloads this repo at @main to exercise
      // the published-action path; nothing else may float on a branch.
      if (ref === 'yao-pkg/pkg-action@main') continue;
      ok(
        /@(v\d+(\.\d+)*|[0-9a-f]{40})$/.test(ref),
        `${name}:${String(i + 1)} — unpinned action reference: ${ref}`,
      );
    }
  }
});
