<!-- GENERATED — do not edit by hand. Source: packages/core/src/inputs.ts. -->

# Inputs

Every `pkg-action` input, grouped by category.

## Build configuration

| Input | Default | Required | Secret | Description |
| --- | --- | --- | --- | --- |
| `config` | — | no | no | Path to a pkg config (.pkgrc, pkg.config.{js,ts,json}, or package.json). Auto-detected when omitted. Mutually exclusive with config-inline. |
| `config-inline` | — | no | yes | Pkg config as a JSON string. Written to a temp file and passed to pkg via --config. Mutually exclusive with config. Registered with core.setSecret so exact matches are redacted from logs; still written to a temp file on the runner, so prefer config for anything beyond trivial knobs. |
| `entry` | — | no | no | Entry script when not specified in the config. |
| `targets` | — | no | no | Comma- or newline-separated pkg target triples, e.g. node22-linux-x64,node22-macos-arm64. Defaults to the host target. |
| `pkg-version` | `~6.19.0` | no | no | npm version specifier for @yao-pkg/pkg (e.g. ~6.19.0). 6.19.0+ is required for the full build-flag surface in pkg config (compress, fallbackToSource, public, publicPackages, options, bytecode, nativeBuild, noDictionary, debug, signature). Bypassed when pkg-path is set. |
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

## Performance & observability

| Input | Default | Required | Secret | Description |
| --- | --- | --- | --- | --- |
| `cache` | `true` | no | no | Cache the pkg-fetch Node downloads between runs. |
| `cache-key` | — | no | no | Override the auto-derived cache key. |
| `step-summary` | `true` | no | no | Write a markdown summary of build time / size / checksum to the job summary. |

## Outputs

| Output | Description |
| --- | --- |
| `binaries` | JSON array of pre-archive binary absolute paths. |
| `artifacts` | JSON array of post-archive artifact absolute paths. |
| `checksums` | JSON array of absolute paths to SHASUMS*.txt files. |
| `digests` | JSON object mapping each artifact basename to its {algo: hex} digest map, e.g. {"app-1.0.0-linux-x64.tar.gz": {"sha256": "…"}}. |
| `version` | Resolved package.json version used in filename templates. |
