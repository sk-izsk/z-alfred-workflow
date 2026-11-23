# VS Code for Alfred

Open recent projects, manage extensions and clone repositories in **VS Code, Cursor, Windsurf,
Zed, VSCodium** and other VS Code forks, from [Alfred 6](https://www.alfredapp.com).
Built on Alfred UI, Alfred 6's native window toolkit.

## Features

| Type | What happens |
| --- | --- |
| `vsc` | The menu: every command below. Keep typing to filter it. |
| `vsc <name>` | Search Recent Projects, already filtered. |
| `vsc install prettier` | Search the Marketplace (or Open VSX for forks). |
| `vsc https://github.com/owner/repo` | Clone: pick a folder (default from settings), ↩ clones and opens it. |
| `vsc ~/path/to/folder` | Open that path. |

**Search Recent Projects**: folders, files, workspaces and remotes, with Finder icons, the git branch and
pins. Filter by type (⌘P). ↩ opens; ⌘K shows every action:
open and close other windows ⇧⌘↩ · Show in Finder ⇧⌘F · Open With… ⌘O (Alfred's File Actions) ·
Open in Terminal ⇧⌘T · Copy Name ⇧⌘C · Copy Path ⇧⌘. · Pin ⇧⌘P.

**Show Installed Extensions**: icon, publisher and version. Open in the editor, in the browser
(⇧⌘O), Show in Finder (⇧⌘F), Copy ID (⇧⌘C), Uninstall.

**Install Extension**: search as you type, with install counts, version and an "Installed" tag. ↩ installs.

**Find Files and Folders** (`vscf`): Spotlight search, opened in your editor. There's also an
**Open in Code Editor** File Action, and **Open with …** for the Finder selection.

⌘[ goes back to the menu from any window. Shortcut keywords: `vscp`, `vsce`, `vsci`, `vscc`,
`vscf`, `vscn`; all of them can be changed in the Workflow's Configuration, where you also pick the
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
