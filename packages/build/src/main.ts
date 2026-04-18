// packages/build — pre-run orchestrator for the top-level composite.
// M0 scaffold: prints a placeholder message and exits 0. Real logic lands in M1.

import { VERSION } from '@pkg-action/core';

function main(): void {
  process.stdout.write(
    `pkg-action build (core v${VERSION}) — M0 scaffold. Not yet functional.\n`,
  );
}

main();
