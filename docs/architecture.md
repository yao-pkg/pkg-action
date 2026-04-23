# Architecture

Living reference for how `pkg-action` is put together. Updated whenever
structure changes; pipeline intent lives here so `packages/build/src/main.ts`
can stay focused on wiring.

> Status: authoritative for v1.0 candidate (2026-04-23). If this file and the
> code disagree, the code wins and this file is a bug.

---

## 1. Repository shape

```
pkg-action/
├── action.yml                  # GENERATED — top-level composite (marketplace entry)
├── matrix/action.yml           # hand-maintained — matrix/ sub-action surface
├── windows-metadata/action.yml # hand-maintained — windows-metadata/ sub-action surface
├── packages/
│   ├── core/                   # shared library — no runs.using, never invoked directly
│   ├── build/                  # runs.using: node24 — main orchestrator
│   ├── matrix/                 # runs.using: node24 — target matrix expansion
│   └── windows-metadata/       # runs.using: node24 — resedit PE patcher
├── scripts/
│   ├── bundle.ts               # esbuild — writes every dist/index.mjs (+ post.mjs)
│   ├── gen-action-yml.ts       # codegen — writes action.yml + packages/build/action.yml + docs/inputs.md
│   └── check-coverage.ts       # CI gate — parses coverage.lcov, enforces minimum
├── test-fixtures/              # apps the e2e workflow builds end-to-end
├── .github/workflows/          # ci.yml + e2e.yml + codeql.yml
├── docs/                       # authored + (inputs.md) generated reference
└── STATUS.yaml                 # transient pre-v1.0 tracker (retired at release)
```

Monorepo uses **yarn workspaces** with `packages/*`. No TypeScript compile
step — Node 22 runs `.ts` directly under `--experimental-strip-types`;
esbuild bundles for publication.

## 2. Scope

The action stops at **build → (optional Windows metadata patch) →
(optional sign) → archive → checksum**. Workflow artifact upload,
GitHub release attach, Docker/Homebrew/Scoop distribution, SBOM, and
SLSA provenance are **out of scope** — users chain dedicated actions
(`actions/upload-artifact`, `softprops/action-gh-release`,
`docker/build-push-action`, `actions/attest-build-provenance`, …)
against the `binaries` / `artifacts` / `checksums` step outputs.

Rationale: each distribution channel has a first-party action that
already does it better. Keeping those inside `pkg-action` would balloon
the input surface, pull in `@actions/github` + `@actions/artifact` +
Octokit, and tightly couple this action to release-flow opinions that
users already have their own answer to.

## 3. Package responsibilities

### `@pkg-action/core`

Pure library, no GitHub Action entry point. Consumers: the three sub-actions
in this repo. All effectful operations (exec, fs) are injected so
tests can swap in doubles.

| Module                      | Purpose                                                                       |
| --------------------------- | ----------------------------------------------------------------------------- |
| `errors.ts`                 | Domain errors (`ValidationError`, `SignError`, `ArchiveError`)                |
| `logger.ts`                 | Actions-logger adapter + `nullLogger` for tests                               |
| `fs-utils.ts`               | `createInvocationTemp`, file helpers                                          |
| `targets.ts`                | `Target` type, `parseTarget`, `hostTarget`, `formatTarget`                    |
| `templates.ts`              | `{name}/{version}/{os}/{arch}/…` filename renderer + token bag                |
| `checksum.ts`               | sha256/sha512/md5 streaming, `writeShasumsFile`, `writeSidecar`               |
| `inputs.ts`                 | `INPUT_SPECS` (source of truth for every input) + `parseInputs`               |
| `pkg-runner.ts`             | `@yao-pkg/pkg` CLI bridge + `buildPkgArgs`                                    |
| `pkg-output-map.ts`         | Reconciles pkg on-disk outputs to `Target[]`                                  |
| `archive.ts`                | tar.gz / tar.xz / zip / 7z writers (yazl for zip)                             |
| `summary.ts`                | Markdown table for `GITHUB_STEP_SUMMARY`                                      |
| `project-info.ts`           | Reads `package.json` name/version at repo or `config` path                    |
| `windows-metadata.ts`       | Pure helpers — input parsing, version-padding, icon spec                      |
| `windows-metadata-apply.ts` | `applyWindowsMetadata` — resedit round-trip                                   |
| `signing.ts`                | `signMacos` / `signWindowsSigntool` / `signWindowsTrustedSigning`             |
| `version.ts`                | `VERSION` constant — esbuild-defined at bundle, read from package.json in dev |
| `index.ts`                  | Barrel                                                                        |

### `@pkg-action/build` (root composite's JS step)

Orchestrates the full pipeline. Entry: `src/main.ts`. Post-step: `src/post.ts`
(tears down the macOS ephemeral keychain via `core.getState('macosKeychains')`).

### `@pkg-action/matrix`

Pure compute — turns `targets` input into a `matrix.include` array with each
entry carrying `{ target, runner, host }`. No build, no fs writes.

### `@pkg-action/windows-metadata`

Thin wrapper around `applyWindowsMetadata` from core. Callable as a stand-alone
action when users want to patch a pre-existing `.exe` without the full build
pipeline.

## 4. Orchestrator pipeline (`packages/build/src/main.ts`)

```
parseInputs              → typed input record + secret registration
readProjectInfo          → package.json name + version (resolves config path)
resolveTargets           → 'host' → hostTarget() | parsed list
runPkg                   → @actions/exec → @yao-pkg/pkg CLI with buildPkgArgs
mapPkgOutputs            → reconcile on-disk .exe/mach-o/elf to Target[]
parseWindowsMetadataInputs → null when unused, short-circuits the resedit step
parseSigningInputs       → null when unused, validates + registerSecrets up-front

per Target:
  render(filename, tokens) → rename output
  applyWindowsMetadata    (win-* only, windowsMeta != null)
  signOneTarget           (macos + win, signing != null)
  archive                 (compress != none)
  computeAllChecksums     (any checksum != none)
  record SummaryRow

writeShasumsFile          → SHASUMS{256,512,MD5}.txt per algo
writeSummary              → GITHUB_STEP_SUMMARY markdown
setOutputs                → binaries / artifacts / checksums / version
```

All heavy lifting lives in `@pkg-action/core`; the orchestrator is a wiring
shell around the `ExecFn` bridge (`getExecOutput` from `@actions/exec`).

## 5. Dependency-injection pattern

No OOP. Every effectful boundary is a `readonly` interface; tests construct
fakes inline:

```ts
// Production
const result = await signMacos(binaryPath, macosInputs, { exec: execBridge, logger, tempDir });

// Test
const calls: string[][] = [];
const exec: ExecFn = (cmd, args) => (
  calls.push([cmd, ...args]),
  Promise.resolve({ exitCode: 0, stdout: '', stderr: '' })
);
await signMacos(binaryPath, macosInputs, { exec, logger: nullLogger, tempDir });
```

Boundaries:

| Boundary     | Interface | Notes                                                         |
| ------------ | --------- | ------------------------------------------------------------- |
| Process exec | `ExecFn`  | Production bridge in `packages/build/src/main.ts::execBridge` |
| Logging      | `Logger`  | `actionsLogger` bridges `@actions/core` annotations           |
| Filesystem   | native    | `node:fs/promises`, no FS DI at this time                     |

## 6. Codegen — `scripts/gen-action-yml.ts`

Source of truth: `packages/core/src/inputs.ts::INPUT_SPECS`. One `InputSpec`
record per input with `name / description / default? / required? / category /
deprecated? / secret?`.

Emitted:

- `/action.yml` — top-level composite. Every input forwarded explicitly to the
  inner `./packages/build` step (GH Actions has no wildcard forward).
- `/packages/build/action.yml` — JS action definition (`runs.using: node24`).
- `/docs/inputs.md` — reference table grouped by `InputCategory`.

**Not** touched by codegen:

- `/matrix/action.yml` and `/windows-metadata/action.yml` (different surfaces).

**CI gate**: `e2e.yml` runs `yarn gen` + `git diff --exit-code` — a missing
regeneration fails the PR.

**Safety**: `yamlString()` rejects embedded control characters rather than
silently emitting an invalid single-quoted scalar (see S2 hardening).

## 7. Bundling — `scripts/bundle.ts`

esbuild, per entry point:

| Entry                                   | Output                                     |
| --------------------------------------- | ------------------------------------------ |
| `packages/build/src/main.ts`            | `packages/build/dist/index.mjs`            |
| `packages/build/src/post.ts`            | `packages/build/dist/post.mjs`             |
| `packages/matrix/src/main.ts`           | `packages/matrix/dist/index.mjs`           |
| `packages/windows-metadata/src/main.ts` | `packages/windows-metadata/dist/index.mjs` |

Config:

- `format: 'esm'`, `platform: 'node'`, `target: 'node22'`, `minifySyntax: true`.
- **Banner**: injects `createRequire(import.meta.url)` — `@actions/http-client`
  - `tunnel` are CJS and call `require('net')`; without the banner esbuild
    replaces these with a throwing `__require`.
- **Define**: `__PKG_ACTION_VERSION__` is inlined from the root
  `package.json#version`. Dev runs (no bundle) fall back to a synchronous
  `readFile` in `packages/core/src/version.ts`.

**CI gate**: `git diff --exit-code '**/dist/**'` catches stale bundles.

## 8. CI topology

### `ci.yml` — lint + typecheck + test + coverage + build drift

```
matrix: [pinned (from .node-version), 24]
steps: install → lint → typecheck → test (with lcov) → coverage gate (≥85%)
       → build → gen → git diff --exit-code over dist/ + action.yml + docs/inputs.md
```

### `e2e.yml` — full composite against fixtures

Triggers: push to main, pull_request (path-filtered so docs-only PRs skip),
workflow_dispatch. Jobs:

- `tiny-cjs` — round-trip on ubuntu / macos / windows
- `codegen-drift` — `yarn gen` + diff
- `matrix-plan` → `matrix-fanout` demo (strategy.matrix consumption)
- `multi-target-linux` single-runner build
- `windows-metadata` round-trip (`.github/scripts/assert-windows-metadata.ts`)

### `codeql.yml` — GitHub CodeQL SAST

## 9. Testing

- **Runner**: Node's built-in `node:test`. No Jest/Vitest — strip-types friendly.
- **Layout**: `packages/<pkg>/test/unit/**/*.test.ts`.
- **Gate**: `scripts/check-coverage.ts coverage.lcov --min 85` fails CI below 85%.
- **No mocking frameworks**: DI doubles only. `t.mock.module` was evaluated and
  rejected in M-1 in favor of explicit test doubles.

## 10. Test fixtures

`test-fixtures/tiny-app-cjs/` and `tiny-app-esm/`. Each is a minimal Node
package whose entry logs its own `package.json#version` and exits — trivially
asserted by the e2e jobs.

Known gap: no fixture yet for TS-source apps, asset-bundling, or
`package.json#bin` overrides — see `STATUS.yaml#pending.e2e-coverage`.

## 11. Release flow (future — v1.0.0)

1. Bump `/package.json#version` to `1.0.0`.
2. `yarn build` — esbuild inlines `"1.0.0"` into every bundled sub-action via `__PKG_ACTION_VERSION__`.
3. `yarn gen` — noop for version, but ensures action.yml + inputs.md are fresh.
4. Commit bundle + codegen output (CI diff gate verifies).
5. Tag `v1.0.0`, push tag.
6. Move `v1` major-alias tag to the new SHA (`git tag -f v1 && git push -f origin v1`).
7. Replace `STATUS.yaml` with `CHANGELOG.md`.

## 12. Known architectural debt

Tracked in `STATUS.yaml#pending.architecture`. Everything else listed under
`pending` is **test-surface** (more fixtures, live credentials) rather than
code correctness.
