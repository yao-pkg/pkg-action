# Architecture

Living reference for how `pkg-action` is put together. Updated whenever
structure changes; pipeline intent lives here so `packages/build/src/main.ts`
can stay focused on wiring.

> Reflects the v1.0 candidate (as of 2026-04-23). Code is the source of
> truth — if this file and the code disagree, the file is stale, file a fix.

---

## 1. Repository shape

```
pkg-action/
├── action.yml                  # GENERATED — Node24 JS action (marketplace entry)
├── matrix/action.yml           # hand-maintained — matrix/ sub-action surface
├── windows-metadata/action.yml # hand-maintained — windows-metadata/ sub-action surface
├── packages/
│   ├── core/                   # shared library — no runs.using, never invoked directly
│   ├── build/                  # runs.using: node24 — main orchestrator
│   ├── matrix/                 # runs.using: node24 — target matrix expansion
│   └── windows-metadata/       # runs.using: node24 — resedit PE patcher
├── scripts/
│   ├── bundle.ts               # esbuild — writes every dist/index.mjs (+ post.mjs)
│   ├── gen-action-yml.ts       # codegen — writes action.yml + docs/inputs.md
│   ├── check-coverage.ts       # CI gate — parses coverage.lcov, enforces minimum
│   ├── sync-workspace-versions.ts # release — root version → every workspace
│   └── move-major-tag.ts       # release — repoints the floating vN tag
├── test-fixtures/              # apps the e2e workflow builds end-to-end
├── .github/workflows/          # ci.yml + e2e.yml + codeql.yml + release.yml
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
in this repo. Test seams exist around the current injected boundaries
(notably exec/logger-facing behavior); filesystem access is not
universally injected today (modules call `node:fs`/`node:fs/promises`
directly).

| Module                      | Purpose                                                                       |
| --------------------------- | ----------------------------------------------------------------------------- |
| `errors.ts`                 | Domain errors (`ValidationError`, `SignError`, `ArchiveError`)                |
| `logger.ts`                 | Actions-logger adapter + `nullLogger` for tests                               |
| `fs-utils.ts`               | `createInvocationTemp`, file helpers                                          |
| `targets.ts`                | `Target` type, `parseTarget`, `hostTarget`, `formatTarget`                    |
| `templates.ts`              | `{name}/{version}/{os}/{arch}/…` filename renderer + token bag                |
| `checksum.ts`               | sha256/sha512/md5 streaming, `writeShasumsFile`, `writeSidecar`               |
| `inputs.ts`                 | `INPUT_SPECS` (action-layer inputs only) + `parseInputs`                      |
| `pkg-runner.ts`             | `@yao-pkg/pkg` CLI bridge + `buildPkgArgs` (no pkg-flag mirroring)            |
| `pkg-output-map.ts`         | Reconciles pkg on-disk outputs to `Target[]`                                  |
| `archive.ts`                | tar.gz / tar.xz / zip / 7z writers (yazl for zip)                             |
| `summary.ts`                | Markdown table for `GITHUB_STEP_SUMMARY`                                      |
| `project-info.ts`           | Reads `package.json` name/version at repo or `config` path                    |
| `windows-metadata.ts`       | Pure helpers — input parsing, version-padding, icon spec                      |
| `windows-metadata-apply.ts` | `applyWindowsMetadata` — resedit round-trip                                   |
| `signing.ts`                | `signMacos` / `signWindowsSigntool` / `signWindowsTrustedSigning`             |
| `version.ts`                | `VERSION` constant — esbuild-defined at bundle, read from package.json in dev |
| `index.ts`                  | Barrel                                                                        |

### `@pkg-action/build` (the root action)

Orchestrates the full pipeline and _is_ `/action.yml`'s `main`. Entry:
`src/main.ts` — restore pkg-fetch cache → `npm i -g @yao-pkg/pkg` → run pkg →
`finalizeBinary` per output → summary → outputs. Post-step: `src/post.ts` (saves
the pkg-fetch cache, then tears down the macOS ephemeral keychain via
`core.getState('macosKeychains')`).

`src/pkg-cache-io.ts` holds the two-phase `@actions/cache` wiring; the key
derivation itself lives in `core/pkg-cache.ts` so it can be tested without the
cache service.

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
restorePkgCache          → @actions/cache, key from derivePkgCacheKey (skipped when cache=false)
installPkg               → npm i -g @yao-pkg/pkg@<pkg-version> (skipped when pkg-path is set)
runPkg                   → @actions/exec → @yao-pkg/pkg CLI with buildPkgArgs
mapPkgOutputs            → reconcile on-disk .exe/mach-o/elf to Target[]
parseWindowsMetadataInputs → null when unused, short-circuits the resedit step
parseSigningInputs       → null when unused, validates + registerSecrets up-front

per Target: finalizeBinary()   → core/finalize-binary.ts
  render(filename, tokens) → rename output
  applyWindowsMetadata    (win-* only, windowsMeta != null)
  sign                    (macos + win, signing != null)
  archive                 (compress != none)
  computeAllChecksums     (any checksum != none)
  record SummaryRow

writeShasumsFile          → SHASUMS{256,512,MD5}.txt per algo
writeSummary              → GITHUB_STEP_SUMMARY markdown
setOutputs                → binaries / artifacts / checksums / digests / version
```

All heavy lifting lives in `@pkg-action/core`; the orchestrator is a wiring
shell around the `ExecFn` bridge (`getExecOutput` from `@actions/exec`). The
per-target work is one `finalizeBinary()` call so the sequencing that actually
matters — patch before sign, sign before checksum — is unit-testable without a
runner.

The post step (`src/post.ts`) saves the pkg-fetch cache, then deletes the
ephemeral keychains and the invocation temp dir. It never fails the job.

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

**Input-surface scope** (2026-04-23): the action intentionally does not
mirror pkg's CLI. Pkg-specific knobs are expressed via the user's pkg config
file, which `buildPkgArgs` forwards through `--config`. The action owns only
concerns that pkg config cannot express: CI-matrix `targets`, the
`pkg-version` / `pkg-path` install choice, archive format, filename template,
checksum algorithms, Windows-metadata resedit patch, signing, cache, and step
summary. Rationale: decouple the action from pkg's CLI evolution — each new
pkg flag otherwise forced a back-compat-preserving input bump here.
Authoritative list of dropped inputs + migration note lives in
[`STATUS.yaml`](../STATUS.yaml) under `input-surface-slim`.

Emitted:

- `/action.yml` — the marketplace entry: `runs.using: node24`, `main`
  `packages/build/dist/index.mjs`, `post` `packages/build/dist/post.mjs`.
- `/docs/inputs.md` — reference table grouped by `InputCategory`.

Deliberately **not** a composite. A composite delegating to
`uses: ./packages/build` resolves that path against the _consumer's_ workspace
rather than this repo ([actions/runner#1348][runner-1348]), so it only worked
when the workspace happened to be a checkout of pkg-action — which is exactly
what every `uses: ./` e2e job set up. Owning the run in one JS entrypoint also
keeps a real `post:` step, which is what tears down the signing keychains. The
`consumer-ref` e2e job and the `no published action.yml references a local
action` unit test both guard the regression.

[runner-1348]: https://github.com/actions/runner/issues/1348

**Not** touched by codegen:

- `/matrix/action.yml` and `/windows-metadata/action.yml` (different surfaces).

**CI gate**: `ci.yml` runs `yarn gen` + `git diff --exit-code`, and `e2e.yml`
also includes a separate `codegen-drift` job — missing regeneration fails the
PR.

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

### `e2e.yml` — full action against fixtures

Triggers: push to main, pull_request (path-filtered so docs-only PRs skip),
workflow_dispatch. Jobs:

- `tiny-cjs` — round-trip on ubuntu / macos / windows
- `codegen-drift` — `yarn gen` + diff
- `matrix-plan` → `matrix-fanout` demo (strategy.matrix consumption)
- `multi-target-linux` single-runner build
- `windows-metadata` round-trip (`.github/scripts/assert-windows-metadata.ts`)
- `claude-code-smoke` — SEA + Zstd across 4 OS/arch combos
- `build-hooks` — preBuild / postBuild / transform
- `consumer-ref` — **the PR gate for consumer-shaped invocation**: the fixture
  is sparse-checked-out at the workspace root and the action under test into
  `_action-under-test/`, so the action directory is not the workspace root.
  Every other job says `uses: ./`, which collapses the two and hides anything
  that depends on the difference. `uses:` accepts no expressions, so a job
  cannot name `<owner>/<repo>@<sha>` for the commit under test — hence the
  subdirectory.
- `consumer-download` — post-merge canary: `uses: yao-pkg/pkg-action@main`,
  the real GitHub-resolved download path. Push-to-main only.
- `self-hosted-node24` — `runs.using: node24` on a self-hosted runner, gated on
  the `HAS_SELF_HOSTED_LINUX` repository variable so it does not queue forever
  when no such runner exists.

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

## 11. Release flow

Driven by **release-it** (`.release-it.json`), triggered from the
`Release` workflow (`workflow_dispatch`, defaults to a dry run). It runs in CI
rather than on a laptop because the release commit carries the `dist/` bundles
consumers execute, and CI is the only place they are guaranteed to be built by
the Node in `.node-version`.

| Step                     | Owner                                | What                                                        |
| ------------------------ | ------------------------------------ | ----------------------------------------------------------- |
| pick the version         | `@release-it/conventional-changelog` | Conventional Commits decide patch/minor/major               |
| `before:init`            | release-it hook                      | `yarn lint`, `yarn typecheck`, `yarn test:unit`             |
| bump root `package.json` | release-it                           |                                                             |
| `after:bump`             | release-it hook                      | `sync-workspace-versions.ts` → `yarn gen` → `yarn build`    |
| `CHANGELOG.md`           | plugin                               | prepended, generated — never hand-edited                    |
| commit + tag             | release-it                           | `chore(release): vX.Y.Z`, tag `vX.Y.Z`                      |
| GitHub release           | release-it                           | body = the generated changelog section                      |
| `after:release`          | release-it hook                      | `move-major-tag.ts` repoints `vN` (skipped for prereleases) |

`sync-workspace-versions.ts` exists so `packages/*/package.json` never claims
`0.0.0` inside a tagged release. Those packages are `private: true` and never
published; intra-workspace deps pin `*` so the sync never has to rewrite
ranges. Only the root version is load-bearing — esbuild inlines it as
`__PKG_ACTION_VERSION__`.

Publishing to the GitHub Marketplace stays manual: it is a checkbox on the
release page with no API.

Retire `STATUS.yaml` once v1.0.0 ships — `CHANGELOG.md` replaces it.

## 12. Known architectural debt

Tracked in `STATUS.yaml#pending.architecture`. Everything else listed under
`pending` is **test-surface** (more fixtures, live credentials) rather than
code correctness.
