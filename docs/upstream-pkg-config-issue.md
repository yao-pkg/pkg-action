<!--
Draft issue to file against yao-pkg/pkg. Post via `gh issue create --repo yao-pkg/pkg ...`
or through the web UI. Delete this file once the upstream issue is open and linked
from STATUS.yaml / PR #13.
-->

# Title

feat(config): accept the CLI-only build flags in the config file

# Body

## Summary

Today the pkg config file (`.pkgrc`, `pkg.config.{js,ts,json}`, `package.json#pkg`) accepts `scripts`, `assets`, `ignore`, `targets`, `outputPath`, `patches`, `sea`, `seaConfig`, and `deployAssets`. Most other build-shaping flags are CLI-only.

It would be very useful to accept these **in the config file as well** so that tooling (CI actions, wrappers, IDE plugins) can drive the build from a single declarative source instead of synthesizing a CLI invocation.

## Flags that are CLI-only today

| CLI flag                                | Suggested config key       |
| --------------------------------------- | -------------------------- |
| `--compress <Brotli\|GZip\|Zstd\|None>` | `compress`                 |
| `--fallback-to-source`                  | `fallbackToSource: true`   |
| `--public`                              | `public: true`             |
| `--public-packages <list>`              | `publicPackages: string[]` |
| `--options <v8>`                        | `options: string[]`        |
| `--no-bytecode`                         | `noBytecode: true`         |
| `--no-dict <list \| *>`                 | `noDict: string[] \| '*'`  |
| `--debug`                               | `debug: true`              |
| `--signature <url>`                     | `signature: string`        |

## Why

Context: we're building the official GitHub Action (yao-pkg/pkg#248, yao-pkg/pkg-action). The action tries to expose pkg's build surface to users via workflow YAML. Two approaches:

1. **Mirror each CLI flag as an action input.** Every time pkg adds/renames a flag we have to bump the action and preserve back-compat — heavy maintenance burden.
2. **Let users declare everything in their pkg config file.** Action forwards `--config`, pkg owns its schema, zero action-side drift.

Approach 2 is cleaner — but it's only partial today because of these CLI-only flags. Users who want SEA mode + Zstd + `fallbackToSource` have to either commit a config for `sea` and pass the rest as CLI flags via the action, or we have to re-mirror them as action inputs.

If pkg accepts the full set in config, the action becomes a thin wrapper that forwards a config path and doesn't have to know anything about pkg's evolving flag set. Users also get one declarative source of truth for "what does this build do" instead of splitting it between `.pkgrc` and a CI YAML.

## Proposed behavior

- CLI flag still wins when both are set (CLI overrides config) — matches the existing `targets` / `outputPath` convention.
- Config values validated with clear errors (unknown key, wrong type) rather than silently ignored.

Happy to help with a PR if there's interest — just wanted to confirm the direction before spending time on it.
