import { test } from 'node:test';
import { strictEqual } from 'node:assert/strict';
import { VERSION } from '../../src/index.ts';

test('core exports a VERSION string', () => {
  strictEqual(typeof VERSION, 'string');
});
