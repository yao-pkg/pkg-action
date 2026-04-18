import { test } from 'node:test';
import { strictEqual, throws } from 'node:assert/strict';
import { buildTokens, closestToken, render } from '../../src/templates.ts';
import { ValidationError } from '../../src/errors.ts';

const FIXED_DATE = new Date(Date.UTC(2026, 3, 18)); // 2026-04-18

const SAMPLE = buildTokens({
  name: 'myapp',
  version: '1.2.3',
  target: 'node22-linux-x64',
  node: 'node22',
  os: 'linux',
  arch: 'x64',
  sha: 'abc1234',
  ref: 'v1.2.3',
  date: FIXED_DATE,
  tag: 'v1.2.3',
});

test('render substitutes every known token', () => {
  strictEqual(render('{name}-{version}-{os}-{arch}', SAMPLE), 'myapp-1.2.3-linux-x64');
});

test('render handles target/node/sha/ref/date/tag', () => {
  strictEqual(
    render('{name}-{version}-{target}-{node}-{sha}-{ref}-{date}-{tag}', SAMPLE),
    'myapp-1.2.3-node22-linux-x64-node22-abc1234-v1.2.3-20260418-v1.2.3',
  );
});

test('render is idempotent when template has no tokens', () => {
  strictEqual(render('plain-file.bin', SAMPLE), 'plain-file.bin');
});

test('render handles repeated tokens', () => {
  strictEqual(render('{name}/{name}-{version}', SAMPLE), 'myapp/myapp-1.2.3');
});

test('render leaves unmatched braces untouched if they are not {word}', () => {
  strictEqual(render('{', SAMPLE), '{');
  strictEqual(render('}', SAMPLE), '}');
  strictEqual(render('{123}', SAMPLE), '{123}');
});

test('render throws ValidationError on unknown token', () => {
  throws(() => render('{oops}', SAMPLE), ValidationError);
});

test('ValidationError includes a Levenshtein suggestion', () => {
  try {
    render('{nam}', SAMPLE);
  } catch (err) {
    if (err instanceof ValidationError) {
      strictEqual(err.message.includes('Did you mean "{name}"'), true);
      return;
    }
    throw err;
  }
  throw new Error('expected ValidationError');
});

test('closestToken returns null for far-off inputs', () => {
  strictEqual(closestToken('xxxxxxxxxxxxx'), null);
});

test('closestToken suggests the nearest known token', () => {
  strictEqual(closestToken('verison'), 'version');
  strictEqual(closestToken('targt'), 'target');
  strictEqual(closestToken('ach'), 'arch');
});

test('buildTokens derives date YYYYMMDD in UTC', () => {
  const t = buildTokens({
    name: 'x',
    version: '0',
    target: 't',
    node: 'n',
    os: 'o',
    arch: 'a',
    date: new Date(Date.UTC(2026, 0, 5, 23, 59, 0)),
  });
  strictEqual(t.date, '20260105');
});

test('buildTokens defaults sha/ref/tag to empty string', () => {
  const t = buildTokens({
    name: 'x',
    version: '0',
    target: 't',
    node: 'n',
    os: 'o',
    arch: 'a',
  });
  strictEqual(t.sha, '');
  strictEqual(t.ref, '');
  strictEqual(t.tag, '');
});
