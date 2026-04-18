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

## Development

- Node ≥ 22 (see `.node-version` for the pinned dev patch).
- `yarn install`
- `yarn build` — esbuild ESM bundle of each sub-action
- `yarn test` — `node --test` with `--experimental-strip-types`
- `yarn lint` — ESLint + Prettier

See `CONTRIBUTING.md` for the strip-types dev loop and `.node-version` policy.

## License

MIT — see [`LICENSE`](./LICENSE).
