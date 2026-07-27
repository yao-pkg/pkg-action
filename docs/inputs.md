<!-- GENERATED — do not edit by hand. Source: packages/core/src/inputs.ts. -->

# Inputs

Every `pkg-action` input, grouped by category.

## Build configuration

| Input | Default | Required | Secret | Description |
| --- | --- | --- | --- | --- |
| `config` | — | no | no | Path to a pkg config. When omitted, pkg auto-detects .pkgrc, .pkgrc.json, pkg.config.js, pkg.config.cjs or pkg.config.mjs next to the entry; the package.json pkg field is used when the entry itself resolves to a package.json. An explicit path may point at a package.json or a standalone config; for a standalone config pkg also needs an entry script, so the action supplies package.json bin when the entry input is unset. Mutually exclusive with config-inline. |
| `config-inline` | — | no | yes | Pkg config as a JSON string. Written to a temp file and passed to pkg via --config. Mutually exclusive with config. Being JSON, it can only carry the shell-string form of the preBuild/postBuild hooks — function hooks and transform need a pkg.config.{js,cjs,mjs} file via config. Registered with core.setSecret so exact matches are redacted from logs, which does not extend to output a hook prints; still written to a temp file on the runner, so prefer config for anything beyond trivial knobs. |
| `entry` | — | no | no | Entry script when not specified in the config. |
| `targets` | — | no | no | Comma- or newline-separated pkg target triples, e.g. node22-linux-x64,node22-macos-arm64. Defaults to the host target. |
| `pkg-version` | `~6.21.0` | no | no | npm version specifier for @yao-pkg/pkg (e.g. ~6.21.0). 6.19.0+ is required for the full build-flag surface in pkg config (compress, fallbackToSource, public, publicPackages, options, bytecode, nativeBuild, noDictionary, debug, signature); 6.21.0+ adds the preBuild, postBuild and transform build hooks. Bypassed when pkg-path is set. |
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

## Build hooks

@yao-pkg/pkg 6.21.0+ runs three hooks from your pkg config. They have no CLI flags and
no action inputs — set them in the file you point `config` at (or let pkg auto-detect it).
The default `pkg-version` (`~6.21.0`) already includes them; only callers who pinned
an older pkg need to raise it.

| Key | Accepts | Runs |
| --- | --- | --- |
| `preBuild` | shell string or function | once, before pkg walks the dependency graph |
| `postBuild` | shell string or function | once per produced binary, after pkg has written it (and, on macOS, ad-hoc signed it) |
| `transform` | function only | per packed file, after path refinement, before bytecode/compression |

The shell form of `postBuild` gets the absolute output path in `PKG_OUTPUT`; the function
form gets it as its first argument. `transform(file, body)` returns a string or Buffer to
replace the contents, or `undefined` to leave the file alone.

```js
// pkg.config.mjs
import { join } from 'node:path';

const SRC_DIR = join(import.meta.dirname, 'src');

export default {
  targets: ['node22-linux-x64'],
  preBuild: 'npm run build',
  postBuild: (output) => console.log(`built ${output}`),
  transform: (file, body) =>
    file.startsWith(SRC_DIR) && file.endsWith('.js')
      ? body.toString().replaceAll('__VERSION__', () => process.env.GITHUB_SHA ?? 'dev')
      : undefined,
};
```

Two things that example is careful about: it scopes the rewrite to your own sources (a bare
`.endsWith('.js')` also rewrites every packed `node_modules` file), and it passes a replacer
function so `$&` and `` $` `` in the replacement are not interpreted. Only interpolate values
you trust — a branch name or PR title lands verbatim in the shipped binary.

> **Hooks are arbitrary code execution.** `preBuild` / `postBuild` shell strings are spawned
> with the runner's full environment, and `transform` is arbitrary JS over every packed file.
> pkg picks a config up from the checked-out tree automatically, so on a workflow that builds
> an untrusted ref (a fork `pull_request`), whoever wrote that ref can run commands in the job —
> alongside any signing certificates and tokens it holds. This capability did not exist before
> pkg 6.21. Build untrusted refs in a job with no secrets, or pin `pkg-version` below 6.21.

> **Do not move or rename the binary from `postBuild`.** The hook runs inside pkg, before
> the action's windows-metadata, signing, archive and checksum stages. Those stages locate
> outputs by predicting pkg's naming heuristic, then fall back to an exact, case-insensitive,
> and finally `<os>-<arch>` substring match over the output directory — a rename defeats all
> three. Use the action's own archive and checksum inputs instead.

### Hooks and `config-inline`

`config-inline` is JSON, so it can only carry the shell-string form of `preBuild` /
`postBuild`. Function hooks and `transform` need a real `pkg.config.{js,cjs,mjs}` file.

pkg refuses `--config <file>` together with a package.json entry, so whenever `config` points
at a standalone config — or `config-inline` is used — an entry script is required. The action
supplies your package.json `bin` automatically; set the `entry` input if there is no `bin`.

## Outputs

| Output | Description |
| --- | --- |
| `binaries` | JSON array of pre-archive binary absolute paths. |
| `artifacts` | JSON array of post-archive artifact absolute paths. |
| `checksums` | JSON array of absolute paths to SHASUMS*.txt files. |
| `digests` | JSON object mapping each artifact basename to its {algo: hex} digest map, e.g. {"app-1.0.0-linux-x64.tar.gz": {"sha256": "…"}}. |
| `version` | Resolved package.json version used in filename templates. |
