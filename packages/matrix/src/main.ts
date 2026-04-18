// packages/matrix — M0 scaffold.
// Real logic (target parsing, runner-label map, cross-compile warnings) lands in M2.

import { VERSION } from '@pkg-action/core';

function main(): void {
  process.stdout.write(
    `pkg-action matrix (core v${VERSION}) — M0 scaffold. Not yet functional.\n`,
  );
}

main();
