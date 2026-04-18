# Contributing to `yao-pkg/pkg-action`

## Runtime floor — Node ≥ 22

- `.node-version` is pinned to an **exact patch**. Bumping it is a breaking-dev-env change — open a separate PR, never bundled with a feature.
- `engines.node: ">=22"` in every `package.json`.
- Action runtime targets `runs.using: node24` (the first GitHub-supported runtime ≥ 22 — `node22` doesn't exist in the runner protocol).

## Local dev — strip-types, not ts-node

We run TypeScript directly via `node --experimental-strip-types`. **Do not** introduce `ts-node`, `tsx`, `swc-node`, or a transform-loader.

- `tsconfig.base.json` enforces `erasableSyntaxOnly: true` — any syntax that would confuse strip-types (enums, namespaces, parameter properties, decorator metadata, `import =`/`export =`) fails compilation.
- The `typescript` devDependency is pinned to the version compatible with the Node floor's bundled `amaro` parser — **do not** bump it independently from `.node-version`.

## Tests — `node:test` only

- No vitest, no jest, no mocha.
- Assertions via `node:assert/strict`, function mocks via `t.mock.fn`, snapshots via `t.assert.snapshot`.
- Module mocking (`t.mock.module`) is treated as experimental until the M-1 spike closes; prefer DI-style test doubles.

## Dependency budget

Hard caps: **6 runtime deps, 3 dev deps.** Every addition requires a justification comment next to its `package.json` entry. See the plan's §16 for the current allow-list and deny-list.

## Commits + PRs

- Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`).
- Rebase onto `main`, not merge.
- CI must be green before merge. `dist/` and generated `action.yml` files are checked via `git diff --exit-code` — run `yarn build` before committing.

## Milestones

See [issue #248 implementation plan](https://github.com/yao-pkg/pkg/issues/248) for the M-1 → v1.0 roadmap and scope boundaries per milestone.
