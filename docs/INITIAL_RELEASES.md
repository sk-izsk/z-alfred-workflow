# Initial releases and merged workflow updates — 2026-11-26

23 workflows receive their first independent `0.1.0` release from merged `dev` commit [`3705bec`](https://github.com/sk-izsk/z-alfred-workflow/commit/3705becf0d0be3542489c2478617e3b22df43766). Six previously released workflows receive new update versions so public downloads include the merged shared UI/navigation and feature changes. Maps, Splitwise and Notion retain their already-published releases from the other merged branch.

Each release has a namespaced tag and one installable `.alfredworkflow` asset. Versions are never overwritten. Bitwarden’s earlier `1.1.0` tag had a failed release job and no published asset; `1.1.1` is a fresh version for the current merged source.

## Initial-release validation

All 23 projects passed frozen-lockfile dependency installation, `bun run check` (including 192 tests), `bun run package`, and the Alfred UI checker on merged source. Archives were inspected for matching plist versions, runtime bundles, licenses and notices, with no local preferences, dependency folders, tool-state directories or log/environment files.

GitHub release jobs repeat checks and packaging on macOS. All 23 published initial-release assets were downloaded and inspected successfully. The six updated assets receive the same check after publishing. GitHub normalizes spaces in uploaded filenames to dots; the names below match the hosted assets. Checks use temporary fixtures; no real cleanup, account mutation or device/network/display changes are performed for publishing. Earlier live checks and limits are recorded in [FINAL_VERIFICATION.md](FINAL_VERIFICATION.md).

| Workflow | Version | Installable release | Tests |
| --- | --- | --- | ---: |
| [z-adhan-time](../workflows/z-adhan-time) | 0.1.0 | [Adhan.Time.alfredworkflow](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-adhan-time%2Fv0.1.0) | 14 |
| [z-bluetooth](../workflows/z-bluetooth) | 0.1.0 | [Bluetooth.alfredworkflow](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-bluetooth%2Fv0.1.0) | 3 |
| [z-calculate-anything](../workflows/z-calculate-anything) | 0.1.0 | [Calculate.Anything.alfredworkflow](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-calculate-anything%2Fv0.1.0) | 7 |
| [z-currency](../workflows/z-currency) | 0.1.0 | [Currency.Exchange.alfredworkflow](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-currency%2Fv0.1.0) | 13 |
| [z-dev-cache-cleaner](../workflows/z-dev-cache-cleaner) | 0.1.0 | [Dev.Cache.Cleaner.alfredworkflow](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-dev-cache-cleaner%2Fv0.1.0) | 5 |
| [z-dev-servers](../workflows/z-dev-servers) | 0.1.0 | [Dev.Servers.alfredworkflow](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-dev-servers%2Fv0.1.0) | 6 |
| [z-dev-utils](../workflows/z-dev-utils) | 0.1.0 | [Dev.Utils.alfredworkflow](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-dev-utils%2Fv0.1.0) | 3 |
| [z-dev](../workflows/z-dev) | 0.1.0 | [Dev.alfredworkflow](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-dev%2Fv0.1.0) | 1 |
| [z-emoji](../workflows/z-emoji) | 0.1.0 | [Emoji.Picker.alfredworkflow](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-emoji%2Fv0.1.0) | 4 |
| [z-folder-navigator](../workflows/z-folder-navigator) | 0.1.0 | [Folder.Navigator.alfredworkflow](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-folder-navigator%2Fv0.1.0) | 13 |
| [z-gif-search](../workflows/z-gif-search) | 0.1.0 | [GIF.Search.alfredworkflow](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-gif-search%2Fv0.1.0) | 4 |
| [z-kill-process](../workflows/z-kill-process) | 0.1.0 | [Kill.Process.alfredworkflow](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-kill-process%2Fv0.1.0) | 24 |
| [z-lunar](../workflows/z-lunar) | 0.1.0 | [Lunar.Controls.alfredworkflow](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-lunar%2Fv0.1.0) | 5 |
| [z-mole](../workflows/z-mole) | 0.1.0 | [Mole.alfredworkflow](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-mole%2Fv0.1.0) | 10 |
| [z-swiss](../workflows/z-swiss) | 0.1.0 | [Swiss.alfredworkflow](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-swiss%2Fv0.1.0) | 4 |
| [z-system-monitor](../workflows/z-system-monitor) | 0.1.0 | [System.Monitor.alfredworkflow](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-system-monitor%2Fv0.1.0) | 4 |
| [z-tag-manager](../workflows/z-tag-manager) | 0.1.0 | [Tag.Manager.alfredworkflow](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-tag-manager%2Fv0.1.0) | 6 |
| [z-translate](../workflows/z-translate) | 0.1.0 | [Translate.alfredworkflow](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-translate%2Fv0.1.0) | 11 |
| [z-weather](../workflows/z-weather) | 0.1.0 | [Weather.alfredworkflow](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-weather%2Fv0.1.0) | 27 |
| [z-wifi](../workflows/z-wifi) | 0.1.0 | [Wi-Fi.alfredworkflow](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-wifi%2Fv0.1.0) | 5 |
| [z-window-navigator](../workflows/z-window-navigator) | 0.1.0 | [Window.Navigator.alfredworkflow](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-window-navigator%2Fv0.1.0) | 4 |
| [z-workflow-manager](../workflows/z-workflow-manager) | 0.1.0 | [Workflow.Manager.alfredworkflow](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-workflow-manager%2Fv0.1.0) | 9 |
| [z-world-clock](../workflows/z-world-clock) | 0.1.0 | [World.Clock.alfredworkflow](https://github.com/sk-izsk/z-alfred-workflow/releases/tag/z-world-clock%2Fv0.1.0) | 10 |

## Updates to previously released workflows

All six updates passed frozen-lockfile installation, checks/tests (141 tests), packaging, UI validation and archive inspection. Test cache/data locations were isolated in temporary directories. Combined with the 23 initial releases, the 29 workflows pass 333 tests.

| Workflow | New version | Reason |
| --- | --- | --- |
| [z-bitwarden](../workflows/z-bitwarden) | 1.1.1 | Publish merged feature, navigation and shared UI changes under a fresh release tag. |
| [z-vscode](../workflows/z-vscode) | 0.1.3 | Publish merged feature, navigation and shared UI changes under a fresh release tag. |
| [z-cald](../workflows/z-cald) | 0.1.3 | Publish merged feature, navigation and shared UI changes under a fresh release tag. |
| [z-brew](../workflows/z-brew) | 0.1.3 | Publish merged feature, navigation and shared UI changes under a fresh release tag. |
| [z-speedtest](../workflows/z-speedtest) | 0.1.3 | Published dependency satisfies Swiss’s Speed Test 0.1.3 minimum; shared UI/navigation changes. |
| [z-github](../workflows/z-github) | 0.1.2 | Publish merged feature, navigation and shared UI changes under a fresh release tag. |

## Reference handoff

See [WORKFLOW_REFERENCES.md](WORKFLOW_REFERENCES.md) for the complete workflow-to-Raycast/source map. A reference is a comparison target, not a claim of feature parity or ownership of copied code. Licensing remains with the per-workflow notices.

GitHub releases do not submit workflows to the Alfred Gallery or post to the forum. No such submission or messaging is part of this task.
