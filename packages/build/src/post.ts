// packages/build — post-run cleanup.
// M0 scaffold: no-op. Real cleanup (keychain teardown, $RUNNER_TEMP wipe) lands in M4.

function post(): void {
  process.stdout.write('pkg-action post — M0 scaffold. Nothing to clean up yet.\n');
}

post();
