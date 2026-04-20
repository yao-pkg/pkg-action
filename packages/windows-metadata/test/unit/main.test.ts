// Unit tests for packages/windows-metadata/src/main.ts.
//
// DI-style: every dependency — inputs, core outputs, apply — is a fake.
// The fake `apply` records its call args so we can assert the sub-action
// translates getInput/env → meta correctly without exercising resedit.

import { test } from 'node:test';
import { deepStrictEqual, ok, strictEqual } from 'node:assert/strict';
import { run, type WindowsMetadataRunDeps } from '../../src/main.ts';
import type { WindowsMetadataInputs } from '../../../core/src/windows-metadata.ts';

interface ApplyCall {
  inputPath: string;
  outputPath: string;
  meta: WindowsMetadataInputs;
}

interface Capture {
  outputs: Array<{ name: string; value: string }>;
  infos: string[];
  failures: string[];
  applies: ApplyCall[];
}

function makeDeps(
  inputs: Record<string, string>,
  applyOverride?: (c: ApplyCall) => Promise<void>,
): { deps: WindowsMetadataRunDeps; calls: Capture; envRestore: () => void } {
  const calls: Capture = { outputs: [], infos: [], failures: [], applies: [] };
  // parseWindowsMetadataInputs reads process.env — stash the INPUT_* keys we
  // need here and restore on teardown.
  const savedEnv: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(inputs)) {
    if (k === 'input' || k === 'output') continue;
    const key = `INPUT_${k.replace(/-/g, '_').toUpperCase()}`;
    savedEnv[key] = process.env[key];
    process.env[key] = v;
  }

  const deps: WindowsMetadataRunDeps = {
    getInput: (name) => inputs[name] ?? '',
    setOutput: (name, value) => calls.outputs.push({ name, value }),
    info: (m) => calls.infos.push(m),
    setFailed: (m) => calls.failures.push(m),
    apply: async (inputPath, outputPath, meta) => {
      const call: ApplyCall = { inputPath, outputPath, meta };
      calls.applies.push(call);
      if (applyOverride !== undefined) await applyOverride(call);
    },
  };

  const envRestore = (): void => {
    for (const [key, prev] of Object.entries(savedEnv)) {
      if (prev === undefined) delete process.env[key];
      else process.env[key] = prev;
    }
  };
  return { deps, calls, envRestore };
}

test('run fails when input is blank', async () => {
  const { deps, calls, envRestore } = makeDeps({});
  try {
    await run(deps);
    strictEqual(calls.failures.length, 1);
    strictEqual(calls.applies.length, 0);
  } finally {
    envRestore();
  }
});

test('run fails when no metadata field is set', async () => {
  const { deps, calls, envRestore } = makeDeps({ input: '/tmp/app.exe' });
  try {
    await run(deps);
    strictEqual(calls.failures.length, 1);
    ok(calls.failures[0]?.includes('no metadata fields'));
    strictEqual(calls.applies.length, 0);
  } finally {
    envRestore();
  }
});

test('run translates bare-name inputs into meta, defaulting output to input', async () => {
  const { deps, calls, envRestore } = makeDeps({
    input: '/tmp/app.exe',
    'product-name': 'TinyApp',
    'file-version': '1.2.3',
    lang: '1041',
  });
  try {
    await run(deps);
    strictEqual(calls.failures.length, 0);
    strictEqual(calls.applies.length, 1);
    const apply = calls.applies[0];
    ok(apply !== undefined);
    strictEqual(apply.inputPath, '/tmp/app.exe');
    strictEqual(apply.outputPath, '/tmp/app.exe'); // defaults to input
    strictEqual(apply.meta.productName, 'TinyApp');
    strictEqual(apply.meta.fileVersion, '1.2.3');
    strictEqual(apply.meta.lang, 1041);
    deepStrictEqual(calls.outputs, [{ name: 'output-path', value: '/tmp/app.exe' }]);
  } finally {
    envRestore();
  }
});

test('run honors a distinct output path when provided', async () => {
  const { deps, calls, envRestore } = makeDeps({
    input: '/tmp/app.exe',
    output: '/tmp/patched.exe',
    'product-name': 'TinyApp',
  });
  try {
    await run(deps);
    strictEqual(calls.failures.length, 0);
    strictEqual(calls.applies[0]?.outputPath, '/tmp/patched.exe');
    deepStrictEqual(calls.outputs, [{ name: 'output-path', value: '/tmp/patched.exe' }]);
  } finally {
    envRestore();
  }
});

test('run surfaces apply() errors via setFailed and emits no output', async () => {
  const { deps, calls, envRestore } = makeDeps(
    { input: '/tmp/app.exe', 'product-name': 'TinyApp' },
    async () => {
      throw new Error('boom');
    },
  );
  try {
    await run(deps);
    strictEqual(calls.failures.length, 1);
    ok(calls.failures[0]?.includes('boom'));
    strictEqual(calls.outputs.length, 0);
  } finally {
    envRestore();
  }
});
