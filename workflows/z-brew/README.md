# Brew for Alfred

Search and manage Homebrew from Alfred 6, inspired by [Raycast Brew](https://www.raycast.com/nhojb/brew).
Native lists, filters, package details and Command-K actions follow your Alfred theme.

Requires macOS, Alfred 6 with Powerpack, Node.js 22+ or Bun, and an existing **Homebrew 7+** installation.
The workflow detects Apple Silicon and Intel Homebrew paths; custom executable paths are configurable.
It does not install its own runtime or Homebrew.

## Commands

Type `brew` for the searchable command menu. All keywords can be changed in Workflow Configuration.

| Keyword | View |
| --- | --- |
| `brewi` | Installed formulae and casks; filter by type, outdated, pinned or needs attention |
| `brews` | Search the public catalog with a details sidebar; e.g. `brews encryption` |
| `brewu` | Available upgrades; select individual packages or all eligible packages |
| `brewa` | Find apps in /Applications and ~/Applications that might be adopted by Homebrew |
| `brewd` | Doctor findings, support tier and suggested remediation as text |
| `brewsvc` | Service status; start, stop or restart through Actions |
| `brewt` | Installed taps; add a tap or review removal |
| `brewv` | Homebrew vulnerability report with skipped/unscanned formulae |
| `brewm` | Update Homebrew, clean up, or clear this workflow’s catalog cache |

Arrow keys navigate lists, Return shows details (or previews adoption / reviews selected upgrades),
Command-K opens actions, Command-R refreshes and Command-[ returns to the menu. Command-F focuses
search. Shift-Command-X toggles an upgrade selection, Shift-Command-U reviews an individual upgrade,
Option-Command-I previews it, and Command-period pins/unpins an installed package.

Green means installed, orange means outdated, and **red warning icons and labels** mean deprecated,
disabled or unmaintained according to Homebrew metadata. Hover for the reason. “Needs attention”
filters those warnings. This is Homebrew’s designation, not an independent check of upstream activity.
Pinned packages appear with a pin and are excluded from upgrade selection.

## Reviewing changes

Install, uninstall, upgrade, pin/unpin, adopt, services, taps, update and cleanup all show the exact
command in a confirmation sheet. Only **Run in Terminal** dispatches it to Terminal or iTerm. Commands
are quoted and targets validated. Refresh the view after Terminal finishes; the workflow does not
track execution or claim success before the command completes. Terminal handles any password prompts.
Homebrew may also upgrade dependencies/dependents or clean old versions using its normal defaults.

Preview Install, Preview Upgrade and Preview Adoption use Homebrew’s `--dry-run`. Adoption candidates
match app artifact names and reported versions; these are suggestions, not a guarantee. Review the
preview before adopting. Homebrew’s `--adopt` validates artifacts and can refuse mismatches. The
workflow never passes `--force` or `--zap`. Ignored adoption candidates can be restored with the
Ignored filter and Actions → Stop Ignoring This App.

Search and adoption download Homebrew’s public formula/cask catalogs, cached for six hours. Refresh
forces a new download. Installed packages, upgrades, services and taps come from the local CLI.
Vulnerability scanning contacts Homebrew’s advisory sources and covers formulae, with coverage gaps
shown in the report. Doctor commands are displayed for manual review; no remediation scripts run
automatically. There is no Raycast menu-bar companion or privileged askpass helper.

## Development

```sh
bun install --frozen-lockfile
bun run check
bun run package
bun run link
```

The package is `dist/Brew.alfredworkflow`. UI bundles and info.plist are generated from TypeScript.
See [TESTING.md](TESTING.md). Releases use `z-brew/vX.Y.Z` after the corresponding PR merges into dev.

## Credits and AI disclosure

The Brew icon and feature inspiration come from [Raycast Brew by nhojb and contributors](https://github.com/raycast/extensions/tree/fd019e878cb973c05b534c15814e5a5a2f6f9111/extensions/brew), MIT.
The Alfred implementation is independent and uses native Alfred UI controls. See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [LICENSE](LICENSE).

This workflow was built with the help of AI tools. Review it before use and report issues on the
[project issue tracker](https://github.com/sk-izsk/z-alfred-workflow/issues).

Back is configurable in Workflow’s Configuration and defaults to **⌘[**. Every Back button and shortcut, including sheets, closes the workflow UI and returns to the main Alfred search.
Screenshots use illustrative data.
