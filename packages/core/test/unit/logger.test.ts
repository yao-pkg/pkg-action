import { test } from 'node:test';
import { strictEqual, deepStrictEqual } from 'node:assert/strict';
import { createTestLogger } from '../../src/logger.ts';

test('test logger records calls in order', () => {
  const { logger, calls } = createTestLogger();
  logger.info('hello');
  logger.warning('watch out', { title: 'careful', file: 'x.ts' });
  logger.startGroup('g');
  logger.debug('d');
  logger.endGroup();

  strictEqual(calls.length, 5);
  strictEqual(calls[0]?.level, 'info');
  strictEqual(calls[0]?.message, 'hello');
  strictEqual(calls[1]?.level, 'warning');
  deepStrictEqual(calls[1]?.props, { title: 'careful', file: 'x.ts' });
  strictEqual(calls[2]?.level, 'group-start');
  strictEqual(calls[3]?.level, 'debug');
  strictEqual(calls[4]?.level, 'group-end');
});

test('setSecret is recorded as a secret call', () => {
  const { logger, calls } = createTestLogger();
  logger.setSecret('super-secret-value');
  strictEqual(calls[0]?.level, 'secret');
  strictEqual(calls[0]?.message, 'super-secret-value');
});

test('isDebug returns false in test logger', () => {
  const { logger } = createTestLogger();
  strictEqual(logger.isDebug(), false);
});
