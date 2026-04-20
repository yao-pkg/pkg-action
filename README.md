# `yao-pkg/pkg-action`

> **Status: M0 scaffold — not yet functional. Do not consume from a workflow until `v1.0.0` is tagged.**

Official GitHub Action to build, sign, archive, and publish Node.js binaries with [`@yao-pkg/pkg`](https://github.com/yao-pkg/pkg).

Tracking issue: [yao-pkg/pkg#248](https://github.com/yao-pkg/pkg/issues/248).
Implementation plan: see the pinned comment on that issue.

## What this will do (once shipped)

```yaml
- uses: yao-pkg/pkg-action@v1
  with:
    targets: node22-linux-x64,node22-macos-arm64,node22-win-x64
    compress: tar.gz
    checksum: sha256
    attach-to-release: true
```

…plus Windows metadata injection (`resedit`), macOS codesign + notarize, Windows signtool + Azure Trusted Signing, archive + checksum + release upload, and a matrix helper for cross-compile-safe multi-OS jobs.

## Matrix helper

When you want one shard per target, pinned to a native runner, use the
`matrix` sub-action:

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
            node22-macos-arm64
            node22-win-x64

  build:
    needs: plan
    runs-on: ${{ matrix.entry.runner }}
    strategy:
      matrix:
        entry: ${{ fromJson(needs.plan.outputs.matrix) }}
    steps:
      - uses: actions/checkout@v6
      - uses: yao-pkg/pkg-action@v1
        with:
          targets: ${{ matrix.entry.target }}
```

Full reference — inputs, self-hosted overrides, cross-compile policy — in
[`docs/matrix.md`](./docs/matrix.md).

## Release attach

Publish the produced binaries to a GitHub release in the same workflow:

```yaml
on:
  push:
    tags: ['v*']

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: yao-pkg/pkg-action@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          targets: node22-linux-x64,node22-macos-arm64,node22-win-x64
          compress: tar.gz
          checksum: sha256
          attach-to-release: true
```

Full reference (non-tag triggers, body templating, asset overwrites,
permissions) in [`docs/publishing.md`](./docs/publishing.md).

## Build provenance (SLSA)

Opt in with `provenance: true` and grant the two required permissions
to emit a signed SLSA build-provenance attestation for every artifact:

```yaml
permissions:
  contents: write
  id-token: write
  attestations: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: yao-pkg/pkg-action@v1
        with:
          targets: node22-linux-x64,node22-macos-arm64,node22-win-x64
          provenance: true
```

Consumers verify with `gh attestation verify`. Full reference —
permissions, release-attach combo, verification examples — in
[`docs/provenance.md`](./docs/provenance.md).

## Development

- Node ≥ 22 (see `.node-version` for the pinned dev patch).
- `yarn install`
- `yarn build` — esbuild ESM bundle of each sub-action
- `yarn test` — `node --test` with `--experimental-strip-types`
- `yarn lint` — ESLint + Prettier

See `CONTRIBUTING.md` for the strip-types dev loop and `.node-version` policy.

## License

MIT — see [`LICENSE`](./LICENSE).
