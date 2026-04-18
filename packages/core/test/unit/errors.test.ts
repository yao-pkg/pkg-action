import { test } from 'node:test';
import { strictEqual, ok, match } from 'node:assert/strict';
import {
  PkgActionError,
  ValidationError,
  PkgRunError,
  formatErrorChain,
} from '../../src/errors.ts';

test('PkgActionError preserves message and name', () => {
  const err = new PkgActionError('boom');
  strictEqual(err.message, 'boom');
  strictEqual(err.name, 'PkgActionError');
});

test('subclasses carry their own name', () => {
  strictEqual(new ValidationError('x').name, 'ValidationError');
  strictEqual(new PkgRunError('x').name, 'PkgRunError');
});

test('cause is preserved via ES2022 Error.cause', () => {
  const inner = new Error('inner');
  const outer = new PkgRunError('outer', { cause: inner });
  strictEqual((outer as { cause?: unknown }).cause, inner);
});

test('file/line/col annotation props attach', () => {
  const err = new ValidationError('bad input', {
    file: 'inputs.ts',
    line: 42,
    col: 7,
  });
  strictEqual(err.file, 'inputs.ts');
  strictEqual(err.line, 42);
  strictEqual(err.col, 7);
});

test('formatErrorChain walks cause chain', () => {
  const a = new Error('root');
  const b = new PkgRunError('wrapper', { cause: a });
  const c = new ValidationError('outer', { cause: b });
  const formatted = formatErrorChain(c);
  ok(formatted.includes('ValidationError'));
  ok(formatted.includes('PkgRunError'));
  ok(formatted.includes('root'));
  match(formatted, / → caused by → /);
});

test('formatErrorChain handles non-Error values', () => {
  strictEqual(formatErrorChain('plain string'), 'plain string');
  strictEqual(formatErrorChain(42), '42');
  strictEqual(formatErrorChain(null), '');
  strictEqual(formatErrorChain(undefined), '');
});

test('formatErrorChain respects maxDepth', () => {
  const a = new Error('ROOT-A');
  const b = new Error('LVL-B', { cause: a });
  const c = new Error('LVL-C', { cause: b });
  const d = new Error('TOP-D', { cause: c });
  const formatted = formatErrorChain(d, 2);
  ok(formatted.includes('TOP-D'));
  ok(formatted.includes('LVL-C'));
  ok(!formatted.includes('LVL-B'));
  ok(!formatted.includes('ROOT-A'));
});
