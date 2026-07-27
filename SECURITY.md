# Security policy

## Reporting a vulnerability

Report privately through GitHub Security Advisories:
**https://github.com/yao-pkg/pkg-action/security/advisories/new**

Please do not open a public issue for anything exploitable.

Include what you have: the action version or ref, a workflow that reproduces it,
and what an attacker gets out of it. A proof-of-concept repository helps most.

You should get an acknowledgement within 5 working days. If a fix is warranted
we aim to ship it within 30 days and will credit you in the advisory unless you
ask us not to.

## What is in scope

This repository — the action's TypeScript sources, the committed `dist/`
bundles, the codegen, and the workflows. Bugs in `@yao-pkg/pkg` itself belong in
[yao-pkg/pkg](https://github.com/yao-pkg/pkg/security); bugs in the Node.js
binaries pkg downloads belong upstream in Node.js.

Things that are worth a report:

- A secret input (`macos-sign-certificate`, `macos-keychain-password`,
  `macos-app-password`, `windows-sign-cert`, `windows-sign-password`,
  `azure-client-secret`) reaching a process argument list, a log line, the step
  summary, or a file that outlives the job. Secrets go to files with `0600` or
  to stdin — never to `argv`, which is world-readable through `/proc` on Linux.
- Anything that lets a workflow input execute code outside the pkg build, or
  that escapes the invocation temp directory.
- An ephemeral macOS signing keychain surviving the post step.
- A checksum or digest output that does not match the bytes on disk.

## Known trust boundaries (not vulnerabilities)

These are how the action is designed to work. Reports about them will be closed
as intended behaviour — but if you can turn one into something worse, tell us.

**pkg build hooks are arbitrary code execution, by design.** `@yao-pkg/pkg`
6.21+ runs `preBuild`, `postBuild`, and `transform` from your pkg config. The
action forwards the config to pkg and never reads those keys, so any code they
contain runs with the job's full privileges — including access to whatever
signing certificates and tokens that job holds.

The consequence is about _which ref you build_. A workflow triggered by
`pull_request_target`, or one that checks out `github.event.pull_request.head.sha`
on a `pull_request` from a fork, hands an untrusted contributor a config file
that the action will honour. Build untrusted refs in a job with no secrets, or
gate them behind an environment approval. The action cannot enforce this — by
the time it runs, the config is already on disk.

**`config-inline` is not a secret channel.** It is registered with
`core.setSecret`, so exact matches get masked in logs, but it is written to a
file on the runner and masking does not extend to whatever a hook prints. Put
secrets in `secrets`, not in `config-inline`.

**The action runs whatever `pkg-version` resolves to.** The default is a `~`
range, so a patch release of `@yao-pkg/pkg` can land in your job without an
action release. Pin an exact version if your threat model needs it.

## Supported versions

Security fixes go to the latest `v1` release and the `v1` floating tag. Older
tags do not get backports.

## Pinning

`uses: yao-pkg/pkg-action@v1` follows a mutable tag — convenient, and it means
you get security fixes without acting. If you would rather review every change,
pin the full commit SHA and let Dependabot bump it:

```yaml
- uses: yao-pkg/pkg-action@<40-char-sha> # v1.0.0
```
