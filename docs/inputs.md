<!-- GENERATED — do not edit by hand. Source: packages/core/src/inputs.ts. -->

# Inputs

Every `pkg-action` input, grouped by category.

## Build configuration

| Input | Default | Required | Secret | Description |
| --- | --- | --- | --- | --- |
| `config` | — | no | no | Path to a pkg config (.pkgrc, pkg.config.{js,ts,json}, or package.json). Auto-detected when omitted. |
| `entry` | — | no | no | Entry script when not specified in the config. |
| `targets` | — | no | no | Comma- or newline-separated pkg target triples, e.g. node22-linux-x64,node22-macos-arm64. Defaults to the host target. |
| `mode` | `standard` | no | no | standard \| sea — selects pkg Standard or SEA mode. |
| `node-version` | `22` | no | no | pkg's bundled Node.js major (e.g. 22, 24). Does not affect the action's own Node runtime. |
| `compress-node` | `None` | no | no | pkg's bundled-binary compression: Brotli \| GZip \| None. |
| `fallback-to-source` | `false` | no | no | Pass pkg --fallback-to-source for bytecode-fabricator failures. |
| `public` | `false` | no | no | Pass pkg --public (ships sources as plaintext). |
| `public-packages` | — | no | no | Comma-separated package names to mark public (pkg --public-packages). |
| `options` | — | no | no | Comma-separated V8 options baked into the binary (pkg --options). |
| `no-bytecode` | `false` | no | no | Pass pkg --no-bytecode. |
| `no-dict` | — | no | no | Comma-separated list of packages for pkg --no-dict (or * for all). |
| `debug` | `false` | no | no | Pass pkg --debug. |
| `extra-args` | — | no | no | Raw extra flags appended to the pkg CLI invocation. |
| `pkg-version` | `~6.16.0` | no | no | npm version specifier for @yao-pkg/pkg (e.g. ~6.16.0). Bypassed when pkg-path is set. |
| `pkg-path` | — | no | no | Absolute path to a pre-installed pkg binary. Skips the implicit npm i -g. |

## Post-build

| Input | Default | Required | Secret | Description |
| --- | --- | --- | --- | --- |
| `strip` | `false` | no | no | Strip debug symbols on Linux/macOS outputs. |
| `compress` | `none` | no | no | Archive format: tar.gz \| tar.xz \| zip \| 7z \| none. |
| `filename` | `{name}-{version}-{os}-{arch}` | no | no | Output filename template. Tokens: {name} {version} {target} {node} {os} {arch} {sha} {ref} {date} {tag}. |
| `checksum` | `sha256` | no | no | Checksum algorithms: comma list of none \| sha256 \| sha512 \| md5. |

## Windows metadata (resedit)

| Input | Default | Required | Secret | Description |
| --- | --- | --- | --- | --- |
| `windows-metadata-file` | — | no | no | Path to a JSON file with any subset of the Windows metadata fields. |
| `windows-icon` | — | no | no | Newline- or comma-separated list of <id>=<path> icon entries, or just <path> for id 1. |
| `windows-product-name` | — | no | no | ProductName string. |
| `windows-product-version` | — | no | no | ProductVersion (auto-padded to four parts). |
| `windows-file-version` | — | no | no | FileVersion (auto-padded to four parts). |
| `windows-file-description` | — | no | no | FileDescription string. |
| `windows-company-name` | — | no | no | CompanyName string. |
| `windows-legal-copyright` | — | no | no | LegalCopyright string (© auto-inserted if omitted). |
| `windows-original-filename` | — | no | no | OriginalFilename string. Defaults to the output basename. |
| `windows-internal-name` | — | no | no | InternalName string. |
| `windows-comments` | — | no | no | Comments string. |
| `windows-manifest` | — | no | no | Path to a raw app.manifest file to embed as RT_MANIFEST. |
| `windows-lang` | `1033` | no | no | Language identifier for VersionInfo. |
| `windows-codepage` | `1200` | no | no | Codepage for VersionInfo strings. |

## Signing & notarization

| Input | Default | Required | Secret | Description |
| --- | --- | --- | --- | --- |
| `macos-sign-identity` | — | no | no | codesign identity (Common Name or SHA-1). |
| `macos-sign-certificate` | — | no | yes | Base64-encoded .p12 certificate. |
| `macos-keychain-password` | — | no | yes | Password for the ephemeral keychain holding the signing identity. |
| `macos-entitlements` | — | no | no | Path to an entitlements plist. |
| `macos-notarize` | `false` | no | no | Run xcrun notarytool + staple after signing. |
| `macos-apple-id` | — | no | yes | Apple ID for notarytool. |
| `macos-team-id` | — | no | yes | Apple Team ID for notarytool. |
| `macos-app-password` | — | no | yes | App-specific password for notarytool. |
| `windows-sign-mode` | `none` | no | no | none \| signtool \| trusted-signing. |
| `windows-sign-cert` | — | no | yes | Base64-encoded .pfx for signtool mode. |
| `windows-sign-password` | — | no | yes | Password for the .pfx. |
| `windows-sign-rfc3161-url` | `http://timestamp.digicert.com` | no | no | RFC3161 timestamp URL for signtool. |
| `windows-sign-description` | — | no | no | Description passed to signtool /d. |
| `azure-tenant-id` | — | no | yes | Azure Trusted Signing: tenant ID. |
| `azure-client-id` | — | no | yes | Azure Trusted Signing: client ID. |
| `azure-client-secret` | — | no | yes | Azure Trusted Signing: client secret. |
| `azure-endpoint` | — | no | no | Azure Trusted Signing: endpoint URL. |
| `azure-cert-profile` | — | no | no | Azure Trusted Signing: certificate profile name. |

## Publishing

| Input | Default | Required | Secret | Description |
| --- | --- | --- | --- | --- |
| `upload-artifact` | `true` | no | no | Upload each produced file as a workflow artifact. |
| `artifact-name` | `{name}-{version}-{target}` | no | no | Artifact name template. Must be unique per target (@actions/artifact v2 rejects collisions). |
| `attach-to-release` | `false` | no | no | Attach artifacts to the release matching the triggering tag. |
| `release-tag` | — | no | no | Override the release tag. Required for non-tag triggers when attach-to-release is true. |
| `release-name` | — | no | no | Release title (optional override). |
| `release-body` | — | no | no | Release body (optional override). |
| `release-draft` | `false` | no | no | Mark the release as draft. |
| `release-prerelease` | `false` | no | no | Mark the release as prerelease. |
| `generate-release-table` | `true` | no | no | Append a markdown table of binaries + sizes + checksums to the release body. |

## Performance & observability

| Input | Default | Required | Secret | Description |
| --- | --- | --- | --- | --- |
| `cache` | `true` | no | no | Cache the pkg-fetch Node downloads between runs. |
| `cache-key` | — | no | no | Override the auto-derived cache key. |
| `step-summary` | `true` | no | no | Write a markdown summary of build time / size / checksum to the job summary. |
| `sbom` | `none` | no | no | SBOM format: none \| cyclonedx \| spdx. (Stretch — deferred to v1.x.) |
| `provenance` | `false` | no | no | Emit SLSA provenance attestation via actions/attest-build-provenance. |

## Outputs

| Output | Description |
| --- | --- |
| `binaries` | JSON array of pre-archive binary absolute paths. |
| `artifacts` | JSON array of post-archive artifact absolute paths. |
| `checksums` | JSON array of absolute paths to SHASUMS*.txt files. |
| `version` | Resolved package.json version used in filename templates. |
