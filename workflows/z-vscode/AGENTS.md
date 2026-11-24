# Working on this repo (humans and coding agents)

- **Bun** for packages and scripts; the bundle runs on **Node** inside Alfred (`workflow/bin/vsc`).
- **TypeScript**, small modules, **arrow functions only** (`func-style: expression`).
- Lint with **oxlint**, format with **oxfmt** (`bun run lint`, `bun run fmt`). `bun run check` must pass.
- No runtime dependencies: Node stdlib + macOS tools (`/usr/bin/sqlite3`, `git`, `open`, `osascript`).
- Windows are TypeScript in `ui/` and compiled to `ui.json` by `bun run build`. Don't hand-edit
  `workflow/*.alfredui/ui.json` or `workflow/info.plist`.
- A window script prints ONE JSON action object (`src/ui.ts` builders). Dataview rows are objects
  keyed `componentId.property` (see `toRow` in `src/commands/*`).
- Modifier shortcuts (⌘↩, ⇧⌘…) go on hidden footer buttons, not root `shortcuts`: as root
  shortcuts they swallow other ⌘ keys.
- Alfred UI can't load images from URLs: download to the cache (`marketplace.ts#fetchIcons`).
- Alfred UI scripts don't receive the Workflow Configuration as env vars; `env.ts#str` falls back
  to info.plist defaults + prefs.plist.
- Leave one small `bun:test` behind for non-trivial logic (parsers, ordering, routing).
- Alfred UI docs: https://www.alfredapp.com/help/alfredui/
