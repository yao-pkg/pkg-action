# `yao-pkg/pkg-action/matrix`

Sub-action that turns a list of [`@yao-pkg/pkg`](https://github.com/yao-pkg/pkg)
target triples into a GitHub Actions matrix, pinned to native runners.

Use it when you want **one shard per target** and each shard to run on
hardware that matches the target — so you never rely on cross-compilation.

## Status

> **ALPHA — ready for early adopters.** Surface is stable for M2; see
> [`STATUS.yaml`](../STATUS.yaml) for full milestone state. Pin a commit
> SHA if you depend on this before `v1.0.0`.

## Inputs

| Input                 | Default | Required | Description                                                                                                                                                                                                    |
| --------------------- | ------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `targets`             | —       | **yes**  | Comma- or newline-separated pkg target triples, e.g. `node22-linux-x64,node22-macos-arm64`.                                                                                                                    |
| `allow-cross-compile` | `false` | no       | When `false`, emits a `::warning::` for targets whose resolved runner would force a cross-compile (see [cross-compile policy](#cross-compile-policy)). When `true`, downgrades those warnings to `info` lines. |
| `runner-overrides`    | `{}`    | no       | JSON object mapping triple (`node22-linux-arm64`) **or** os-arch shortcut (`linux-arm64`) to a runner label. Useful for self-hosted fleets.                                                                    |

## Outputs

| Output   | Description                                                                     |
| -------- | ------------------------------------------------------------------------------- |
| `matrix` | JSON array of `{target, runner}` objects, ready to pipe into `strategy.matrix`. |

## Default runner map

| Target os-arch                                     | Default runner     |
| -------------------------------------------------- | ------------------ |
| `linux-x64`, `linuxstatic-x64`, `alpine-x64`       | `ubuntu-latest`    |
| `linux-arm64`, `linuxstatic-arm64`, `alpine-arm64` | `ubuntu-24.04-arm` |
| `macos-x64`                                        | `macos-13`         |
| `macos-arm64`                                      | `macos-latest`     |
| `win-x64`                                          | `windows-latest`   |
| `win-arm64`                                        | `windows-11-arm`   |

The map lives in [`packages/core/src/targets.ts`](../packages/core/src/targets.ts)
(`DEFAULT_RUNNER_LABELS`) and is the single source of truth — GitHub
deprecates labels on its own schedule and we update them in one place.

## Plan → fan-out pattern

Split the workflow into two jobs: a single `plan` job that calls `matrix`,
and a `fan-out` job that consumes its output via `strategy.matrix`.

```yaml
jobs:
  plan:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.plan.outputs.matrix }}
    steps:
      - uses: actions/checkout@v6
      - id: plan
        uses: yao-pkg/pkg-action/matrix@v1
        with:
          targets: |
            node22-linux-x64
            node22-linux-arm64
            node22-macos-arm64
            node22-win-x64

  build:
    needs: plan
    runs-on: ${{ matrix.entry.runner }}
    strategy:
      fail-fast: false
      matrix:
        entry: ${{ fromJson(needs.plan.outputs.matrix) }}
    steps:
      - uses: actions/checkout@v6
      - uses: yao-pkg/pkg-action@v1
        with:
          targets: ${{ matrix.entry.target }}
          compress: tar.gz
          checksum: sha256
```

Why two jobs?

- `strategy.matrix` is evaluated **before** any steps in that job run, so
  the matrix has to come from an upstream job's output.
- Keeping `plan` on a cheap `ubuntu-latest` runner avoids spinning up a
  macOS or Windows runner just to parse inputs.

## Self-hosted overrides

Supply `runner-overrides` as JSON to redirect specific targets to your
fleet. Both full triples and os-arch shortcuts are honored — the triple
wins when both match:

```yaml
- uses: yao-pkg/pkg-action/matrix@v1
  with:
    targets: node22-linux-arm64,node22-linux-x64
    runner-overrides: |
      {
        "linux-arm64": "my-arm-fleet",
        "node22-linux-x64": "self-hosted-ubuntu-prod"
      }
```

## Cross-compile policy

The `matrix` sub-action never blocks a build — it only annotates. For each
expanded entry it infers the runner's host os/arch (from the label's
presence in `DEFAULT_RUNNER_LABELS`) and calls
`crossCompileRisk(host, target)`. Known landmines:

| Pair                           | Reason                                                                                                                                              |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Linux host → any macOS target  | produces non-functional binaries ([pkg#183](https://github.com/yao-pkg/pkg/issues/183)).                                                            |
| Non-arm64 host → `linux-arm64` | pkg bytecode fabricator bug on Node 22 ([pkg#87](https://github.com/yao-pkg/pkg/issues/87) / [pkg#181](https://github.com/yao-pkg/pkg/issues/181)). |
| Non-Windows host → `win-x64`   | same fabricator bug on Node 22.                                                                                                                     |
| Non-macOS host → `macos-arm64` | signed-binary requirement; cross-signed binaries will not run.                                                                                      |

When a risky pair is detected and `allow-cross-compile` is `false`
(default), the sub-action emits a GitHub `::warning::` annotation. Set
`allow-cross-compile: true` to demote the warning to a plain log line
(the entry still appears in the matrix output).

Self-hosted runners — any label not in the default map — skip the check
entirely. We don't have enough information about your fleet to second-
guess it.

## End-to-end reference

See [`.github/workflows/e2e.yml`](../.github/workflows/e2e.yml), job
`matrix-plan` / `matrix-fanout`, for a working plan→fan-out wiring used as
a smoke test in CI.
