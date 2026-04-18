// packages/windows-metadata — M0 scaffold.
// Real resedit integration (icon, version info, strings, manifest) lands in M3.

import { VERSION } from '@pkg-action/core';

function main(): void {
  process.stdout.write(
    `pkg-action windows-metadata (core v${VERSION}) — M0 scaffold. Not yet functional.\n`,
  );
}

main();
