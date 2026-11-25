# Working in this repository

- Identify assumptions and biases; offer counterpoints when evidence warrants them.
- Each `workflows/<name>` is an independent Bun + TypeScript project. Run commands there.
- Follow nested workflow instructions. Preserve workflow identifiers, licenses and notices.
- Generate `ui.json` and `info.plist` from their TypeScript sources; do not hand-edit them.
- Run the affected workflow's `bun run check` and `bun run package` before proposing a merge.
- Keep secrets, local Alfred preferences, dependencies and compiled bundles out of Git.
- Use feature branches and PRs into `dev`; use namespaced tags as described in RELEASING.md.

- Every workflow must expose a configurable Back shortcut, default `⌘[`, and a visible Back action
  at every UI level, including sheets. Follow the VS Code/Bitwarden finish → post pattern: close
  the current workflow UI and reopen Alfred's main search. Keep Back behavior consistent.
