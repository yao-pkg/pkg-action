// Thin wrapper around @actions/core so the rest of the codebase depends on our
// logger interface, not directly on @actions/core. Lets tests inject a fake logger
// and keeps setup-for-tests cheap.

import * as core from '@actions/core';

export interface Logger {
  debug(message: string): void;
  info(message: string): void;
  warning(message: string, props?: AnnotationProps): void;
  error(message: string, props?: AnnotationProps): void;
  notice(message: string, props?: AnnotationProps): void;
  startGroup(name: string): void;
  endGroup(): void;
  setSecret(value: string): void;
  isDebug(): boolean;
}

export interface AnnotationProps {
  title?: string;
  file?: string;
  startLine?: number;
  endLine?: number;
  startColumn?: number;
  endColumn?: number;
}

/** The real logger — talks to GitHub Actions via @actions/core. */
export const actionsLogger: Logger = {
  debug: (m) => core.debug(m),
  info: (m) => core.info(m),
  warning: (m, p) => core.warning(m, p),
  error: (m, p) => core.error(m, p),
  notice: (m, p) => core.notice(m, p),
  startGroup: (n) => core.startGroup(n),
  endGroup: () => core.endGroup(),
  setSecret: (v) => core.setSecret(v),
  isDebug: () => core.isDebug(),
};

/**
 * Create a silent logger that captures calls for tests.
 * Returns the logger plus the captured record for assertions.
 */
export function createTestLogger(): { logger: Logger; calls: LoggerCall[] } {
  const calls: LoggerCall[] = [];
  const record = (level: LoggerCall['level'], message: string, props?: AnnotationProps): void => {
    // Under exactOptionalPropertyTypes, omit `props` entirely when undefined.
    if (props === undefined) {
      calls.push({ level, message });
    } else {
      calls.push({ level, message, props });
    }
  };
  const logger: Logger = {
    debug: (m) => record('debug', m),
    info: (m) => record('info', m),
    warning: (m, p) => record('warning', m, p),
    error: (m, p) => record('error', m, p),
    notice: (m, p) => record('notice', m, p),
    startGroup: (n) => record('group-start', n),
    endGroup: () => record('group-end', ''),
    setSecret: (v) => record('secret', v),
    isDebug: () => false,
  };
  return { logger, calls };
}

export interface LoggerCall {
  level: 'debug' | 'info' | 'warning' | 'error' | 'notice' | 'group-start' | 'group-end' | 'secret';
  message: string;
  props?: AnnotationProps;
}
