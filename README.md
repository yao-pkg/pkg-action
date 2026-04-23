# `yao-pkg/pkg-action`

> **Status: ALPHA — API still shifting until `v1.0.0`.**

Official GitHub Action to build Node.js binaries with
[`@yao-pkg/pkg`](https://github.com/yao-pkg/pkg).

Scope is intentionally narrow: **build → (optional Windows metadata
patch) → (optional sign) → archive → checksum**. The action stops at
producing signed, checksummed files on disk and emitting their paths
as step outputs. Shipping those files to a GitHub release, a workflow
artifact, a container registry, or a package manager is a separate
concern — chain a dedicated action against the `binaries` / `artifacts`
/ `checksums` outputs.

Tracking issue: [yao-pkg/pkg#248](https://github.com/yao-pkg/pkg/issues/248).

## Quick start

```yaml
- uses: yao-pkg/pkg-action@v1
  id: build
  with:
    targets: node22-linux-x64,node22-macos-arm64,node22-win-x64
    compress: tar.gz
    checksum: sha256

- uses: actions/upload-artifact@v4
  with:
    name: pkg-binaries
    path: "${{ join(fromJson(steps.build.outputs.artifacts), '\n') }}"
```

## pkg configuration

The action does **not** mirror pkg's CLI flags as inputs. Pkg-specific knobs
— SEA mode, bundled Node compression, `public` / `publicPackages`, V8
`options`, `noBytecode`, `noDict`, `debug`, bytecode-fabricator fallback —
live in your pkg config file (`.pkgrc.json`, `pkg.config.{js,ts,json}`, or
the `pkg` field of `package.json`). See
[yao-pkg/pkg's README](https://github.com/yao-pkg/pkg#config) for the full
schema.

Example — SEA mode with Brotli-compressed Node + fallback:

```jsonc
// .pkgrc.json
{
  "bin": "src/main.js",
  "mode": "sea",
  "compressNode": "Brotli",
  "fallbackToSource": true,
}
```

```yaml
- uses: yao-pkg/pkg-action@v1
  with:
    config: .pkgrc.json
    targets: node22-linux-x64
```

### Inline config

For trivial setups you can skip the file and pass the config as a JSON string
via `config-inline` — the action writes it to a temp file and points pkg at
it. Mutually exclusive with `config`.

```yaml
- uses: yao-pkg/pkg-action@v1
  with:
    targets: node22-linux-x64
    config-inline: |
      {
        "bin": "src/main.js",
        "mode": "sea",
        "compressNode": "Brotli"
      }
```

> **Do not embed secrets in `config-inline`** — the value is written to disk
> and echoed into the build log. It is not registered with
> `core.setSecret`.

The action's inputs cover only concerns pkg config cannot express: matrix
targets, pkg install version/path, archive format, filename template,
checksum algorithms, Windows-metadata resedit patch, macOS/Windows signing,
cache, step summary.

## Outputs

| Output      | Shape                                                                     |
| ----------- | ------------------------------------------------------------------------- |
| `binaries`  | JSON array of absolute paths (bare binaries)                              |
| `artifacts` | JSON array — archive when `compress != none`, else the binary             |
| `checksums` | JSON array of SHASUMS file paths (one per algorithm)                      |
| `digests`   | JSON object `{ "<artifact basename>": { "sha256": "…", "sha512": "…" } }` |
| `version`   | Project version from `package.json#version`                               |

## Matrix helper

One shard per target, pinned to a native runner:

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

Reference: [`docs/matrix.md`](./docs/matrix.md).

## Windows metadata + signing

- Windows PE resource patch (ProductName, CompanyName, FileVersion,
  icon, manifest) via `resedit` — set any `windows-*` input.
- macOS codesign + optional notarytool staple.
- Windows signtool or Azure Trusted Signing.

All signing happens between Windows-metadata patch and archive, so the
shasum and archive contain the signed bytes. Full input reference:
[`docs/inputs.md`](./docs/inputs.md).

## After the build — example handoffs

Attach to a GitHub release:

```yaml
- uses: yao-pkg/pkg-action@v1
  id: build
  with:
    targets: node22-linux-x64,node22-macos-arm64,node22-win-x64
    compress: tar.gz
    checksum: sha256

- uses: softprops/action-gh-release@v2
  with:
    files: |
      ${{ join(fromJson(steps.build.outputs.artifacts), '\n') }}
      ${{ join(fromJson(steps.build.outputs.checksums), '\n') }}
```

Build + push a Docker image:

```yaml
- uses: yao-pkg/pkg-action@v1
  id: build
  with:
    targets: node22-linux-x64

- uses: docker/build-push-action@v6
  with:
    context: .
    push: true
    tags: ghcr.io/${{ github.repository }}:latest
    build-args: BIN_PATH=${{ fromJson(steps.build.outputs.binaries)[0] }}
```

SLSA provenance:

```yaml
- uses: actions/attest-build-provenance@v4
  with:
    subject-path: ${{ join(fromJson(steps.build.outputs.artifacts), '\n') }}
```

Homebrew tap, Scoop bucket, npm package — all live in the same
"consume outputs, run a dedicated action" pattern.

## Development

- Node ≥ 22 (see `.node-version` for the pinned dev patch).
- `yarn install`
- `yarn build` — esbuild ESM bundle of each sub-action
- `yarn test` — `node --test` with `--experimental-strip-types`
- `yarn lint` — ESLint + Prettier

## License

MIT — see [`LICENSE`](./LICENSE).
