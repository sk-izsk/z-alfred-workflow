# Mole

Native Alfred 6 views for the installed [Mole CLI](https://mole.fit): system health, disk analysis, cleanup previews and optimization previews. Open `moleui` or choose Mole in Swiss. Each command is a navigation level; Back restores the preceding menu/folder, filter and selection.

- **System Status** reads `mole status --json`. Sectioned sidebar with live value badges and scrollable details. Return refreshes the reading.
- **Disk Usage** reads `mole analyze --json <folder>`. Enter descends into a directory or opens a file. Actions includes Reveal in Finder. Configure the starting folder, including `/Volumes/My SSD`.
- **Clean System** runs `mole clean --dry-run` and displays grouped native rows with the actual total size, item count and per-item size badges.
- **Optimize System** runs `mole optimize --dry-run` and displays grouped native rows with the actual available-optimization count.

Cleanup and optimization require an explicit review action after a successful preview. Continuing launches the corresponding command in Terminal so Mole can present its own confirmations and privilege prompts. The workflow does not silently elevate privileges, suppress Mole's prompts, or claim a cleanup succeeded when Terminal was only opened. No cleanup is performed just by opening a preview. Refresh the preview after making changes.

All Mole screens use native Alfred controls. No web view, HTML renderer or separate browser is used. Loading/error states stay inside the native list. Cleanup/optimization actions are disabled until a successful dry-run preview is ready. Section headings, metric badges and full-width disk rows follow the supplied reference screenshots; Alfred’s fixed row heights and theme remain native.

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

Shared UI: windows use the 780-point reference width with active-display clamping. Back defaults to Hyper+B (Control + Option + Shift + Command + B); Configuration includes the Hyper toggle, four modifier checkboxes, Back key and custom shortcut. Footer labels use Hyper+B. Existing explicit custom Back shortcuts remain active until Hyper configuration is explicitly saved.

Long CLI previews run in a separate worker. The native UI polls session results once a second, keeping Back/search responsive; preview stdin is closed and execution has a 90-second timeout. Errors replace the loading placeholder.

Terminal actions use **Terminal application** in Workflow Configuration: Ghostty, Terminal, iTerm2, kitty, WezTerm, Alacritty or a custom executable. Ghostty uses its native AppleScript API (verified with installed Ghostty 1.4); macOS may request Automation permission. Custom arguments are a JSON array with `{command}` and `{cwd}` placeholders. Existing explicit terminal choices are preserved. No terminal is installed automatically.

Read-only previews show an animated busy indicator, elapsed time and the latest CLI scan line while running. Clean/Optimize stay disabled until a valid preview completes. Load completion and failure never send a finish/close action; Back and Escape remain user actions. Alfred’s embedded window can still hide when another application takes focus; the configurable Separate window option is available for persistent presentation.
