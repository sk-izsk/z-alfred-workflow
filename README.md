# VS Code for Alfred

Open recent projects, manage extensions and clone repositories in **VS Code, Cursor, Windsurf,
Zed, VSCodium** and other VS Code forks, from [Alfred 6](https://www.alfredapp.com).
Built on Alfred UI, Alfred 6's native window toolkit.

## Features

| Type | What happens |
| --- | --- |
| `code` | The menu: every command below. Keep typing to filter it. |
| `code <name>` | Search Recent Projects, already filtered. |
| `code install prettier` | Search the Marketplace (or Open VSX for forks). |
| `code https://github.com/owner/repo` | Clone: pick a folder (default from settings), ↩ clones and opens it. |
| `code ~/path/to/folder` | Open that path. |
| `code gh <name>` | Your GitHub repos (plus a public search): ↩ clone window, ⌘↩ clone now. Needs `gh`. |
| `code profile` | Open a new window with one of your VS Code profiles. |
| `code sync` | Settings Sync: sync now, turn on/off (runs the Command Palette command). |
| `code > command` | Run any Command Palette command in your editor. |

With a git URL on the clipboard, `code` shows **Clone owner/repo** first (turn off in the configuration).

**Search Recent Projects**: folders, files, workspaces and remotes, with Finder icons, the git branch,
uncommitted changes (●), ahead/behind (↑↓) and pins. Set **Project Folders** to also list git repos you
haven't opened yet. Filter by type (⌘P), including Git Repos. ↩ opens; ⌘K shows every action:
open and close other windows ⇧⌘↩ · Open in ▸ another editor · Open with Profile ▸ · Show in Finder ⇧⌘F ·
Open With… ⌘O (Alfred's File Actions) · Open in Terminal ⇧⌘T (Ghostty, iTerm…: set Terminal App) ·
Open on GitHub ⇧⌘G · Copy Remote URL · Copy Name ⇧⌘C · Copy Path ⇧⌘. · Pin ⇧⌘P · Remove from Recent Projects ⌃X.

**Change Theme** (`codet`): every color theme available in a profile (packs with several themes show one
row each). Pick the profile and Light/Dark/High Contrast at the top; ↩ applies it to that profile.
Optional live preview while you move through the list (⎋ puts the old theme back).

**Clone** (`codec [folder] [url]`): type a folder name for suggestions (Spotlight, or a path with Tab to
drill down), then paste a URL, or have one on the clipboard. ↩ opens the clone window with that folder,
⌘↩ clones and opens right away.

**Show Installed Extensions**: per profile, filter All / Themes / Other. Preview the Marketplace page
(⌘Y), open in the editor or browser (⇧⌘O), Show in Finder (⇧⌘F), Copy ID (⇧⌘C), Uninstall from the profile.

**Install Extension**: search as you type, or pick a category (Themes, Languages, Formatters…) to see the
most installed. Install counts, version, an "Installed" tag, ⌘Y preview, Install in Profile ▸.

**Find Files and Folders** (`codef`): Spotlight search, opened in your editor. There's also an
**Open in Code Editor** File Action, and **Open with …** for the Finder selection.

⌘[ goes back to the menu from any window. Shortcut keywords: `codep`, `codee`, `codei`, `codec`,
`codef`, `codet`, `coden`; all of them can be changed in the Workflow's Configuration, where you also pick the
editor, the clone folder, the terminal app and a hotkey.

## Requirements

- Alfred 6 with the Powerpack
- Node.js (Homebrew, nvm, Volta, fnm… are found automatically)
- Your editor's app in `/Applications` or `~/Applications`

No API keys. The Marketplace search is public, and cloning uses your own git credentials (SSH keys
or the macOS Keychain).

## Development

```bash
bun install
bun run build     # bundle src/ → workflow/bin/vsc.mjs, write ui.json + info.plist
bun run link      # symlink workflow/ into Alfred (then edit, rebuild, reopen)
bun run check     # typecheck, oxlint, oxfmt, tests
bun run package   # dist/VS Code.alfredworkflow
```

```
src/            runtime (Node), small modules: editors, projects, git, extensions, marketplace, clone…
src/commands/   one file per window/menu; each returns Alfred UI JSON actions
ui/             window definitions in TypeScript → workflow/<name>.alfredui/ui.json
scripts/        build, info.plist (plist.ts), icons, link, package
workflow/       what Alfred loads (generated files are git-ignored)
```

See [AGENTS.md](AGENTS.md) for conventions.

## License

MIT. Parts are adapted from the MIT-licensed Raycast extension; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
