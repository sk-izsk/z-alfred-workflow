# Working in this repository

- Identify assumptions and biases; offer counterpoints when evidence warrants them.
- Each `workflows/<name>` is an independent Bun + TypeScript project. Run commands there.
- Follow nested workflow instructions. Preserve workflow identifiers, licenses and notices.
- Generate `ui.json` and `info.plist` from their TypeScript sources; do not hand-edit them.
- Run the affected workflow's `bun run check` and `bun run package` before proposing a merge.
- Keep secrets, local Alfred preferences, dependencies and compiled bundles out of Git.
- Use feature branches and PRs into `dev`; use namespaced tags as described in RELEASING.md.

- Every workflow must expose a configurable Back shortcut, default `Hyper+B` (`⌃⌥⇧⌘B`), and a visible Back action
  in every footer, including sheets. Never put Back inside the Actions / ⌘K menu. Back returns
  one UI level, restoring the previous screen and its state. Sheets close to their parent view.
  Only Back at the first screen uses finish → post to reopen Alfred's main search.

- Workflow command menus count as navigation levels: a list opened from a workflow menu returns
  to that menu, never directly to empty Alfred search.

- Follow [UI_CONVENTIONS.md](UI_CONVENTIONS.md): standard width 780, screen-aware clamping,
  configurable Hyper modifiers and compact footer labels. Apply to current/new workflows now;
  keep existing and future workflows consistent, preserving user choices.

- Use `shared/sheet.ts` for native sheets so Back, primary actions and Escape stay consistent.
- Any terminal handoff must use `shared/terminal.ts` and expose the shared terminal selector in Workflow Configuration; preserve existing user choices.
