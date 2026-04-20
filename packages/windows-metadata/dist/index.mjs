import { createRequire as __pkgActionCreateRequire } from 'node:module';
const require = __pkgActionCreateRequire(import.meta.url);

// packages/core/src/index.ts
var VERSION = "0.0.0";

// packages/windows-metadata/src/main.ts
function main() {
  process.stdout.write(
    `pkg-action windows-metadata (core v${VERSION}) \u2014 M0 scaffold. Not yet functional.
`
  );
}
main();
