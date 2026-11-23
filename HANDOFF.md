# Handoff (2026-11-23)

Status for whoever picks this up next (Codex, a person or another session).

## Done
- Repo scaffold: Bun, TypeScript, oxlint, oxfmt, MIT license, README, AGENTS.md, CONTRIBUTING and third-party notices.
- Runtime (`src/`):
  - 17 editors, including Zed and Zed Preview.
  - Recent projects from VS Code's `state.vscdb` (shared and per-app paths) and Zed's `db.sqlite`.
  - Git branch read from HEAD, plus pins.
  - Installed extensions, plus Marketplace and Open VSX search with a cached icon download.
  - Git URL parsing, clone, and Finder selection.
- Windows (`ui/` → `workflow/*.alfredui`): Recent Projects, Installed Extensions, Install Extension and Clone.
- `vsc` menu (Script Filter):
  - Routes to the windows.
  - `vsc install x` prefix routing.
  - A git URL becomes a Clone item.
  - A typed path opens that path.
  - New Window, Agents Window, Find, and Open the Finder selection.
- `info.plist` from code (`scripts/plist.ts`):
  - Keywords `vsc`, `vscp`, `vsce`, `vsci`, `vscc`, `vscf` (Spotlight File Filter, like the old `codef`) and `vscn`.
  - An unset hotkey, the "Open in Code Editor" File Action, and the full Workflow Configuration.
- Original icons (`scripts/icons.swift`).
- `bun run check` passes: tsc, oxlint, oxfmt, 8 tests.
- The workflow is linked into Alfred with `bun run link`.
- Checked against real data from the command line:
  - 85 recent projects, with branches.
  - 133 installed extensions.
  - The "prettier" Marketplace search matches the Raycast screenshot.

## Not verified in Alfred yet (do this first)
Nobody has looked at the windows on screen yet. Alfred's panel doesn't appear in screen captures.
Open each window and check the items below.
1. Layout of each window against the Raycast screenshots:
   - Row height, the "Title  dim path" line, and the pill backgrounds (branch, version, Installed).
   - Footer: "Open in Code ↩ | Actions ⌘K".
   - The ‹ back button.
2. `fileicon` images in dataview rows, and the footer `editorIcon` update from `editorChrome()`.
3. ⌘K popup menu: entries use `text\thint` to right-align the shortcut. If the tab shows literally, drop the hint (`src/ui.ts#menuItem`).
4. Picker `items` update (type filter), `typingstopped` Marketplace search, async install and clone with the "Installing…/Cloning…" status.
5. Clone window: the `opendialog` folder picker fills the field.
6. After a window closes:
   - ⌘[ / ‹ returns to `vsc`.
   - ⌘O hands off to Alfred File Actions.
   - Both go through `src/commands/post.ts`.
7. "Close other windows" uses System Events. It needs Accessibility permission for Alfred and silently does nothing without it.

## Left / ideas
- Remove from Recent Projects (needs a write to VS Code's DB; Raycast does this with `sqlite3`).
- Command Palette (Raycast ships it disabled), grid layout, and merging `storage.json` backups.
- Zed recents assume the 2025+ `workspaces.paths` schema. No Zed DB on the dev machine, so this is untested.
- `git init`, the first commit, a GitHub repo, then delete `ref/` and the source zip. Also delete `New File.txt` (the agent wasn't allowed to delete it).
- Submit to the Alfred Gallery once it's stable.

## Commands
```bash
bun install && bun run build && bun run link   # dev loop
bun run check                                  # must pass
bun run package                                # dist/VS Code.alfredworkflow
```
