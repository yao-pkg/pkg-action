# Build provenance

`yao-pkg/pkg-action` can emit a signed [SLSA build-provenance
attestation](https://slsa.dev/provenance/v1) for every artifact it
produces, using GitHub's native
[`actions/attest-build-provenance`](https://github.com/actions/attest-build-provenance).

## Opting in

```yaml
permissions:
  contents: write # for release attach, if you use it
  id-token: write # REQUIRED: lets the runner mint an OIDC token
  attestations: write # REQUIRED: writes the attestation to the repo

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: yao-pkg/pkg-action@v1
        with:
          targets: node22-linux-x64,node22-macos-arm64,node22-win-x64
          compress: tar.gz
          checksum: sha256
          provenance: true # ← off by default
```

The composite action skips the provenance step entirely when
`provenance: false` (default). The two required permissions are only
consulted when you opt in, so adding the input to an existing workflow
is a no-op until you also flip the flag.

## What gets attested

One attestation per artifact in the `artifacts` output — the
post-archive files when you ship archives, or the raw binaries when
`compress: none`. The `subject-path` is fed to
`actions/attest-build-provenance@v4` line-by-line, so every target in
your matrix gets its own discrete attestation.

Attestations are uploaded to the repo's attestations store and, when
the run is triggered by a tag push, linked to that release tag.

## Verifying a downloaded artifact

Use `gh attestation verify` from the GitHub CLI on the consumer side:

```bash
gh attestation verify \
  --owner yao-pkg \
  ./tiny-app-cjs-1.0.0-linux-x64.tar.gz
```

`gh` downloads the attestation bundle from the repo, walks the Sigstore
bundle, and confirms the workflow identity matches what produced the
artifact. Add `--source-repo yao-pkg/pkg-action` to assert that the
artifact was built by this specific action.

## Permissions — why both `id-token` and `attestations`

- `id-token: write` — lets the runner request an OIDC token from
  GitHub, which Sigstore's Fulcio CA uses as the identity for the
  short-lived signing cert.
- `attestations: write` — authorizes the runner to POST the completed
  attestation bundle to the repo's `/attestations` endpoint.

Without both, `actions/attest-build-provenance@v4` fails fast — the
step errors out loudly rather than silently omitting the attestation.
That's intentional: a missing attestation should block the release,
not sneak through.

## Combining with release attach

Provenance + release attach is the recommended publishing flow for a
tagged release. Both run off the same finalized file list:

```yaml
permissions:
  contents: write
  id-token: write
  attestations: write

on:
  push:
    tags: ['v*']

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
          provenance: true
```

Consumers can then `gh attestation verify` against the file they
downloaded from the GitHub release.

## See also

- [`docs/publishing.md`](./publishing.md) — the release-attach channel
  that provenance normally rides alongside.
- [`docs/inputs.md`](./inputs.md) — reference for the `provenance`
  input.
- [SLSA provenance v1
  spec](https://slsa.dev/spec/v1.0/provenance) — the attested
  predicate.
