# Software Bill of Materials (SBOM)

`yao-pkg/pkg-action` can emit a Software Bill of Materials alongside
every build. The SBOM is a machine-readable inventory of the production
dependencies baked into the binary — supply-chain teams can diff it
release-over-release, scan it for known CVEs, and plug it into Sigstore
attestations as a third-party predicate.

Both industry-standard formats are supported:

- **CycloneDX 1.5** (`sbom: cyclonedx`) — the OWASP spec, consumed by
  `cyclonedx-cli`, Anchore Grype, Snyk, and Dependency-Track.
- **SPDX 2.3** (`sbom: spdx`) — the Linux-Foundation spec, consumed by
  Trivy, `spdx-tools`, and FOSSA.

## Opting in

```yaml
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
          sbom: cyclonedx # or spdx — none is the default
```

The generator walks the project's `node_modules` tree using the same
resolution rules as Node (direct `node_modules/<name>/package.json`
lookup with ancestor fallback for hoisted layouts), collecting every
production dependency transitively. `devDependencies` are deliberately
excluded — they are compile-time only and do not end up in the pkg
binary.

## What gets emitted

One SBOM file per invocation (the SBOM describes the source project, not
per-target binaries). The file name is:

- `<project>-<version>.cdx.json` for CycloneDX
- `<project>-<version>.spdx.json` for SPDX

It is written to the invocation's final directory, uploaded as its own
workflow artifact (`<project>-<version>-sbom`), and attached to the
GitHub release when `attach-to-release: true`.

### CycloneDX shape

```jsonc
{
  "bomFormat": "CycloneDX",
  "specVersion": "1.5",
  "serialNumber": "urn:uuid:…",
  "metadata": {
    "timestamp": "2026-04-22T…",
    "component": { "type": "application", "name": "my-app", "version": "1.0.0" },
  },
  "components": [
    { "type": "library", "name": "foo", "version": "1.2.3", "purl": "pkg:npm/foo@1.2.3" },
  ],
  "formulation": [
    {
      "components": [
        {
          "type": "file",
          "name": "my-app-1.0.0-linux-x64.tar.gz",
          "hashes": [{ "alg": "SHA-256", "content": "…" }],
        },
      ],
    },
  ],
}
```

### SPDX shape

```jsonc
{
  "spdxVersion": "SPDX-2.3",
  "SPDXID": "SPDXRef-DOCUMENT",
  "name": "my-app-1.0.0",
  "creationInfo": { "created": "2026-04-22T…", "creators": ["Tool: yao-pkg/pkg-action@1.0.0"] },
  "packages": [
    { "SPDXID": "SPDXRef-Package-my-app", "name": "my-app", "versionInfo": "1.0.0" },
    { "SPDXID": "SPDXRef-Package-npm-foo-1.2.3", "name": "foo", "versionInfo": "1.2.3" },
  ],
  "relationships": [
    {
      "spdxElementId": "SPDXRef-DOCUMENT",
      "relationshipType": "DESCRIBES",
      "relatedSpdxElement": "SPDXRef-Package-my-app",
    },
    {
      "spdxElementId": "SPDXRef-Package-my-app",
      "relationshipType": "DEPENDS_ON",
      "relatedSpdxElement": "SPDXRef-Package-npm-foo-1.2.3",
    },
  ],
}
```

Each produced artifact appears as a separate file entry with a SHA-256
(and optional SHA-512 / MD5) checksum, cross-referenced from the root
project via a `GENERATES` relationship. Consumers can match the file
checksum in the SBOM against the downloaded binary to confirm the SBOM
corresponds to the exact artifact on disk.

## Consuming the SBOM

### Scan for CVEs

```bash
# Download the attached SBOM from the release, then:
grype sbom:./my-app-1.0.0.cdx.json
# or
trivy sbom ./my-app-1.0.0.spdx.json
```

### Diff against a prior release

```bash
cyclonedx diff ./v1.0.0.cdx.json ./v1.1.0.cdx.json
```

## See also

- [`docs/publishing.md`](./publishing.md) — the release-attach channel
  that carries the SBOM alongside the binaries.
- [`docs/provenance.md`](./provenance.md) — SLSA provenance attestation,
  the signed complement to the SBOM.
- [`docs/inputs.md`](./inputs.md) — reference for the `sbom` input.
