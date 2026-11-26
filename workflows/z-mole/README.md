# Mole

Native Alfred 6 views for the installed [Mole CLI](https://mole.fit): system health, disk analysis, cleanup previews and optimization previews. Open `moleui` or choose Mole in Swiss. Each command is a navigation level; Back restores the preceding menu/folder, filter and selection.

- **System Status** reads `mole status --json`. Select a section for scrollable native details; Return copies that section.
- **Disk Usage** reads `mole analyze --json <folder>`. Enter descends into a directory or opens a file. Actions includes Reveal in Finder. Configure the starting folder, including `/Volumes/My SSD`.
- **Clean System** runs `mole clean --dry-run` and displays the actual preview text.
- **Optimize System** runs `mole optimize --dry-run` and displays its actual preview text.

Cleanup and optimization require an explicit review action after a successful preview. Continuing launches the corresponding command in Terminal so Mole can present its own confirmations and privilege prompts. The workflow does not silently elevate privileges, suppress Mole's prompts, or claim a cleanup succeeded when Terminal was only opened. No cleanup is performed just by opening a preview. Refresh the preview after making changes.

![Native Mole status](assets/screenshots/status.png)

Install Mole separately; the workflow detects Homebrew paths or accepts an absolute executable path in Configuration. It never installs or updates Mole itself. An incompatible CLI response shows an error. Read-only scans have a 90-second timeout and an 8 MB output limit; disk listings show the first 500 entries, previews the last 600 non-empty lines. JSON status is fetched when opened/refreshed rather than retained as a supposedly live reading.

The shared width is 780 points with screen-aware clamping. Back defaults to Hyper+B; Configuration exposes the toggle, four modifiers, Back key and custom shortcut. Back remains visible outside Actions, including the review sheet. A root Back restores Swiss when launched there.

```sh
bun install
bun run check
bun run package
bun run link
```

Tests verify command allowlisting, dry-run flags, shell quoting and response parsing. The installed CLI's read-only status and demo-folder analysis were checked; actual cleanup/optimization execution is not tested against the user's system.

Behavioral reference: [Raycast Mole](https://github.com/raycast/extensions/tree/459326f4f557692a79246dba2d013746f56d724b/extensions/mole/). No reference code or artwork was copied. MIT. Built with help from AI tools.
