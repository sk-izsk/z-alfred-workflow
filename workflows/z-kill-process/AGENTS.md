# Kill Process

- Independent Bun/TypeScript project; generate metadata/UI, preserve com.izsk.kill-process.
- Keep UI native and theme-aware; CPU/RAM bars and visible Back live in the footer, not Actions.
- Never signal real user processes during automated verification. Use fake drivers, or a disposable
  child process created specifically for integration testing, addressed by its exact PID and identity.
- Keep confirmation snapshots single-use. Recheck PID, owner, start time and executable before signals.
- Do not add sudo, reconstructed shell launch commands, automatic force-kill fallbacks or process-tree
  termination inferred from a text search. Restart only known app bundles after observed exit.
- Preserve icon license/credits and AI disclosure. Run check, package and Alfred UI checker.
