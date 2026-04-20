import { createRequire as __pkgActionCreateRequire } from 'node:module';
const require = __pkgActionCreateRequire(import.meta.url);

// packages/core/src/index.ts
var VERSION = "0.0.0";

// packages/matrix/src/main.ts
function main() {
  process.stdout.write(`pkg-action matrix (core v${VERSION}) \u2014 M0 scaffold. Not yet functional.
`);
}
main();
