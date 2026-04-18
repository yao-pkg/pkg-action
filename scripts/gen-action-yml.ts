// scripts/gen-action-yml.ts — code-generates action.yml files + docs/inputs.md
// from the single source of truth in packages/core/src/inputs.ts.
//
// Run via: node --experimental-strip-types scripts/gen-action-yml.ts
//
// M0 scaffold: no-op. Real implementation lands in M1 when packages/core/src/inputs.ts
// exists and exposes an INPUT_METADATA record. Until then the top-level action.yml and
// sub-action yml files are hand-maintained stubs.

function main(): void {
  process.stdout.write(
    'pkg-action gen-action-yml — M0 scaffold. No inputs metadata yet; nothing to generate.\n',
  );
}

main();
