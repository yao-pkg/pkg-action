# Downstream distribution: Homebrew + Scoop

Once a release is published (`attach-to-release: true`), `pkg-action`
can automatically open a pull request against a Homebrew tap
(`homebrew-<name>`) and/or a Scoop bucket with a refreshed manifest
pointing at the freshly uploaded assets.

Both channels share the same flow:

1. The binary is built, signed, and checksummed.
2. The archive is attached to the GitHub release.
3. A commit is pushed to a branch on the downstream repo with the
   generated formula / manifest (updating the existing file when the
   branch already exists).
4. A PR is opened from that branch against the downstream repo's
   default branch — or refreshed if the PR already exists.

## Homebrew tap

### Minimal setup

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
          targets: node22-macos-arm64,node22-macos-x64,node22-linux-x64
          compress: tar.gz
          checksum: sha256
          attach-to-release: true
          homebrew-tap-repo: yao-pkg/homebrew-tap
          homebrew-tap-token: ${{ secrets.HOMEBREW_PAT }}
```

### Required tokens

The built-in `GITHUB_TOKEN` **cannot** write to a different repository.
You must provide a fine-grained PAT with `contents: write` on the tap
repo via `homebrew-tap-token`. If the tap lives in the same repo as the
build (uncommon), you can omit the input — the action falls back to
`GITHUB_TOKEN`.

### Generated formula

The formula uses `on_macos` / `on_linux` blocks with `on_arm` / `on_intel`
branches. Only the archs you built are emitted — e.g. building only
`node22-macos-arm64` produces an arm-only formula.

```ruby
class MyApp < Formula
  desc "…"
  homepage "https://github.com/yao-pkg/my-app"
  version "1.0.0"
  license "MIT"
  on_macos do
    on_arm do
      url "https://github.com/…/my-app-1.0.0-macos-arm64.tar.gz"
      sha256 "…"
    end
    on_intel do
      url "https://github.com/…/my-app-1.0.0-macos-x64.tar.gz"
      sha256 "…"
    end
  end

  def install
    bin.install "my-app"
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/my-app --version")
  end
end
```

### Customizing

| Input                          | Default                             |
| ------------------------------ | ----------------------------------- |
| `homebrew-formula-name`        | project name                        |
| `homebrew-formula-description` | `<project> — pkg-action build`      |
| `homebrew-formula-homepage`    | `https://github.com/<owner>/<repo>` |
| `homebrew-formula-license`     | _unset_                             |
| `homebrew-formula-binary`      | formula name                        |
| `homebrew-tap-branch`          | `pkg-action/<project>-<version>`    |

## Scoop bucket

### Minimal setup

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
          targets: node22-win-x64,node22-win-arm64
          compress: zip
          checksum: sha256
          attach-to-release: true
          scoop-bucket-repo: yao-pkg/scoop-bucket
          scoop-bucket-token: ${{ secrets.SCOOP_PAT }}
```

### Generated manifest

```json
{
  "version": "1.0.0",
  "description": "…",
  "homepage": "https://github.com/yao-pkg/my-app",
  "license": "MIT",
  "architecture": {
    "64bit": {
      "url": "https://github.com/…/my-app-1.0.0-win-x64.zip",
      "hash": "sha256:…",
      "bin": "my-app.exe",
      "extract_dir": "my-app-1.0.0-win-x64"
    }
  }
}
```

`arm64` targets land under `architecture.arm64`; x64 targets under
`architecture.64bit` — matching Scoop's expected schema.

### Customizing

| Input                        | Default                             |
| ---------------------------- | ----------------------------------- |
| `scoop-manifest-name`        | project name                        |
| `scoop-manifest-description` | `<project> — pkg-action build`      |
| `scoop-manifest-homepage`    | `https://github.com/<owner>/<repo>` |
| `scoop-manifest-license`     | _unset_                             |
| `scoop-manifest-binary`      | `<manifest-name>.exe`               |
| `scoop-bucket-branch`        | `pkg-action/<project>-<version>`    |

## Why a PR, not a direct push?

The default flow opens a PR rather than pushing to the tap/bucket's
main branch. That gives the tap maintainer a review checkpoint,
preserves a clean signing chain for downstream verification, and makes
automated rollback trivial (close the PR).

If you run the tap yourself and want autodeploy, set
`homebrew-tap-branch` / `scoop-bucket-branch` to the tap's default
branch — the action will still commit the file (no PR is needed since
the branch is already the target).

## See also

- [`docs/publishing.md`](./publishing.md) — the release-attach channel
  these manifests point at.
- [`docs/inputs.md`](./inputs.md) — full reference for every input.
