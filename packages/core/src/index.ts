// @pkg-action/core — public barrel.
//
// M1.1 foundation + M1.2 input/target domain modules. Subprocess layer
// (pkg-runner, pkg-output-map, archive, uploader, summary) lands in the next
// M1 chunk.

export * from './errors.ts';
export * from './logger.ts';
export * from './fs-utils.ts';
export * from './targets.ts';
export * from './templates.ts';
export * from './checksum.ts';

export const VERSION = '0.0.0';
