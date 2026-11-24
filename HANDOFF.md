# Handoff (2026-11-23)

Status for whoever picks this up next (Codex, a person, or another session).

## Done
- **Recent Projects**:
  - Git branch, uncommitted changes (●) and ahead/behind (↑↓), refreshed in the background.
  - Pins, and a "Git Repos" type filter.
  - Folder scan (Workflow Configuration: Project Folders) for repos you haven't opened yet.
  - ⌘K: Open in ▸ another editor, Open with Profile ▸, Terminal (configurable, e.g. Ghostty), Open on GitHub, Copy Remote URL, Remove from Recent Projects (⌃X).
- **Change Theme** (`vsct`):
  - Profile and Light/Dark/High Contrast pickers.
  - Themes come from that profile's extensions plus the built-in ones, one row per theme in a pack.
  - ↩ writes `workbench.colorTheme` to that profile's settings (`src/jsonc.ts` changes only the top-level key).
  - Optional live preview; the window's `quit` event restores the old theme.
- **Installed Extensions**: profile and All/Themes/Other pickers, ⌘Y preview (Marketplace page in a webkitview sheet), uninstall per profile.
- **Install Extension**: category picker (top installs when the search is empty), ⌘Y preview, Install in Profile ▸.
- **`vsc` menu**:
  - Clone from the clipboard, `vsc gh` (the `gh` CLI), `vsc profile`, `vsc sync`.
  - `vsc > command` uses System Events to type into the Command Palette, so Alfred needs Accessibility permission.
  - Change Theme.
- **`vscc [folder] [url]`**: a Script Filter with Spotlight/path folder suggestions and the clipboard URL. ↩ opens the clone window with that folder; ⌘↩ clones right away. The clone window layout is fixed.
- **Earlier work**:
  - Projects, Extensions, Install, Clone, the `vscf` finder, the File Action, 17 editors including Zed, and the `bun run check` pipeline.
  - The fixes from the "lists stay empty" PR.

## Verify in Alfred (not seen on screen yet: Alfred hides its panel from screen captures)
1. Each window's layout: Themes (two pickers in the search bar), Extensions (two pickers), Install (category picker), Clone (aligned rows).
2. A `submenu` in the ⌘K popup (Open in ▸, Open with Profile ▸, Install in Profile ▸).
3. The ⌘Y preview sheet: does the webkitview load the Marketplace page? It runs Microsoft's own scripts, so it may be slow.
4. Live theme preview, and that ⎋ (the `quit` event) restores the theme.
5. `vsc sync` / `vsc >` need Accessibility permission for Alfred.
6. `vscc`: Tab completion into folders, then ⌘↩ (needs the ⌘ connection the plist adds).

## Known limits
- VS Code may rewrite the recent list from memory when it quits, so a removed project can come back.
- The theme ✓ only matches when the stored theme id still exists (some packs renamed their themes).
- Zed: recents assume the 2025+ DB schema (untested here); themes, profiles and extensions are VS Code-only.
- Skipped on purpose (user's call): CI/releases (#9), screenshots/Gallery (#10), appearance setting (#4).

## Commands
```bash
bun install && bun run build && bun run link   # dev loop
bun run check                                  # must pass
bun run package                                # dist/VS Code.alfredworkflow
```
