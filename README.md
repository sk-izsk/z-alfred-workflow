# z-alfred-workflow

Alfred workflows maintained in one repository, with independent builds, versions and releases.
Inspired by [Raycast Extensions](https://github.com/raycast/extensions): each workflow owns its
source, documentation, assets and package configuration under `workflows/`.

| Workflow | What it does | Install the existing release |
| --- | --- | --- |
| [Bitwarden](workflows/z-bitwarden) | Search your vault, generate passwords, use authenticator codes and manage Sends. Two-step login, background locking and sync, and Firefox support | [Bitwarden 1.1.0](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-bitwarden%2Fv1.1.0) |
| [VS Code](workflows/z-vscode) | Open projects, manage extensions and themes, and clone repositories across supported editors | [VS Code 0.1.2](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-vscode%2Fv0.1.2) |
| [Calendar](workflows/z-cald) | Browse months, join upcoming meetings and create events in macOS Calendar | [Calendar 0.1.2](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-cald%2Fv0.1.2) |
| [Brew](workflows/z-brew) | Search packages, review upgrades, adopt apps and manage services and taps | [Brew 0.1.2](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-brew%2Fv0.1.2) |
| [Speed Test](workflows/z-speedtest) | Live Ookla speed meters, connection details and image export | [Speed Test 0.1.2](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-speedtest%2Fv0.1.2) |
| [GitHub & Git](workflows/z-github) | GitHub activity, full-history My PRs and local repositories | Initial release pending |
| [Kill Process](workflows/z-kill-process) | Monitor CPU/RAM, terminate processes and restart apps | Initial release pending |
| [Adhan Time](workflows/z-adhan-time) | City-local prayer calendar and next-prayer countdown | Initial release pending |
| [Currency Exchange](workflows/z-currency) | Arithmetic, cross-rates, pinned targets and provider-based history | Initial release pending |
| [Calculate Anything](workflows/z-calculate-anything) | Native results using your installed unit/conversion engine | Initial release pending |
| [Workflow Manager](workflows/z-workflow-manager) | Installed workflows, Gallery, updates and configuration | Initial release pending |
| [Translate](workflows/z-translate) | Clipboard and text translation with native split panes | Initial release pending |
| [World Clock](workflows/z-world-clock) | Offline timezones, starred locations and native analog grid | Initial release pending |
| [Swiss](workflows/z-swiss) | Search and open independent tools with return navigation | Initial release pending |
| [Weather](workflows/z-weather) | Saved cities, colorful conditions and detailed weather forecasts | Initial release pending |

Download a `.alfredworkflow` asset and double-click it to install. These workflows require macOS,
Alfred 6 with the Powerpack and Node.js; see each workflow's README for its other requirements.
Future packages will appear in [this repository's releases](https://github.com/sk-izsk/z-alfred-workflow/releases).

## Repository layout

```text
workflows/
  z-bitwarden/       Source, tests, screenshots, build scripts and workflow files
  z-vscode/          Source, tests, screenshots, build scripts and workflow files
  z-cald/            Quick calendar, upcoming meetings and event creation
  z-github/          GitHub activity, pull requests and local repositories
  z-speedtest/       Live internet speed meters and connection details
  z-brew/            Homebrew packages, upgrades, adoption and diagnostics
.github/             Shared CI, independent releases and contribution templates
docs/                Migration notes
```

Each project keeps its own `package.json`, `bun.lock`, license and third-party notices. There are
no nested Git repositories, submodules or shared dependency upgrades to coordinate.

## Development

Install [Bun](https://bun.sh) and use macOS (builds require `plutil` and zsh).

```bash
git clone https://github.com/sk-izsk/z-alfred-workflow.git
cd z-alfred-workflow/workflows/z-bitwarden # or workflows/z-vscode from the repository root
bun install --frozen-lockfile
bun run check
bun run package
```

The package is written to that workflow's `dist/` folder. For local Alfred development, run
`bun run link` from the workflow folder, then rebuild after edits. This redirects that workflow's
development symlink to this checkout; it keeps the existing workflow identifier.

Open feature PRs into `dev`. See [CONTRIBUTING.md](CONTRIBUTING.md) for adding workflows and
[RELEASING.md](RELEASING.md) for independent release tags. CI checks and packages all workflows.

## Migration

Both original commit histories are retained through import merge commits. Existing release tags
and assets remain on their original GitHub repositories; no new release is published by this
migration. See [the migration record](docs/MIGRATION.md) for imported revisions and cutover steps.

## License and credits

[MIT](LICENSE). Each workflow retains its own license and third-party notices. Raycast inspired
the repository organization; credits for adapted workflow code and assets remain in each project.

## AI disclosure

AI tools helped organize this repository and prepare the migration. See each workflow's README
for its own disclosure and review the code before use.
