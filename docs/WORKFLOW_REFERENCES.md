# Workflow reference catalog

Prepared 2026-11-26 for a cross-check against the supplied screenshots, Raycast extensions and upstream projects. This covers all 32 active workflows in merged `dev`, including the three workflows from the other merged branch. A reference does not imply copied code or complete feature parity; consult each workflow’s README and THIRD_PARTY_NOTICES.md.

Raycast listing owners/names were read from package.json at the credited source revision and the listing URLs were checked. Source links retain the recorded commit hashes. Bitwarden and VS Code were originally credited against moving `main`; those links are intentionally labeled as such.

## Workflow-to-reference mapping

| Workflow / our source | Raycast listing | Upstream source / comparison | Notes |
| --- | --- | --- | --- |
| [Bitwarden](../workflows/z-bitwarden) | [Bitwarden Vault](https://www.raycast.com/jomifepe/bitwarden) | [Bitwarden Vault (moving main)](https://github.com/raycast/extensions/tree/main/extensions/bitwarden/) | Bitwarden CLI and vault behavior; existing password generation remains here. |
| [VS Code](../workflows/z-vscode) | [Visual Studio Code](https://www.raycast.com/thomas/visual-studio-code) | [Visual Studio Code (moving main)](https://github.com/raycast/extensions/tree/main/extensions/visual-studio-code-recent-projects/) | Also Alfred Open with VS Code; upstream main is a moving reference, not a pinned revision. |
| [Calendar](../workflows/z-cald) | [Quick Calendar](https://www.raycast.com/fuksman/calendar) | [Quick Calendar (e38232e)](https://github.com/raycast/extensions/tree/e38232e713cc42a58cac81b8d3af9261fd1624e5/extensions/calendar/) | Quick Calendar UX, adapted to native macOS Calendar. |
| [Brew](../workflows/z-brew) | [Brew](https://www.raycast.com/nhojb/brew) | [Brew (fd019e8)](https://github.com/raycast/extensions/tree/fd019e878cb973c05b534c15814e5a5a2f6f9111/extensions/brew/) | Homebrew package/service management. |
| [Speed Test](../workflows/z-speedtest) | [Speedtest](https://www.raycast.com/tonka3000/speedtest) | [Speedtest (c4e0f79)](https://github.com/raycast/extensions/tree/c4e0f79975a011e16032382f2d1263f712f8b43c/extensions/speedtest/) | Ookla CLI; no Python speedtest-cli substitution. |
| [GitHub & Git](../workflows/z-github) | [GitHub](https://www.raycast.com/raycast/github)<br>[Git Repos](https://www.raycast.com/moored/git-repos) | [GitHub (00ddc63)](https://github.com/raycast/extensions/tree/00ddc630b0c8ba7e3136fff1ad5b200796a6ef65/extensions/github/)<br>[Git Repos (dccfc88)](https://github.com/raycast/extensions/tree/dccfc8877dd0e658295cb4b6d29b4a0a1b79baf8/extensions/git-repos/) | Both GitHub and Git Repos references; see the two source/listing links. |
| [Kill Process](../workflows/z-kill-process) | [Kill Process](https://www.raycast.com/rolandleth/kill-process) | [Kill Process (3e9e8cf)](https://github.com/raycast/extensions/tree/3e9e8cf4594e19ce5939a7bbdb7f19a90a719397/extensions/kill-process/) | Monitor CPU/RAM, terminate processes and restart apps |
| [Adhan Time](../workflows/z-adhan-time) | [Adhan Time](https://www.raycast.com/mzaien/adhan-time) | [Adhan Time (e38232e)](https://github.com/raycast/extensions/tree/e38232e713cc42a58cac81b8d3af9261fd1624e5/extensions/adhan-time/) | City-local prayer calendar and next-prayer countdown |
| [Currency Exchange](../workflows/z-currency) | [Currency Exchange](https://www.raycast.com/xeric/currency-exchange) | [Currency Exchange (e38232e)](https://github.com/raycast/extensions/tree/e38232e713cc42a58cac81b8d3af9261fd1624e5/extensions/currency-exchange/) | Also ExchangeRate-API, UniRateAPI and ECB/AllRatesToday; three local quick favorites. |
| [Splitwise](../workflows/z-splitwise) | [Splitwise](https://www.raycast.com/ilian/splitwise) | [Splitwise (e38232e)](https://github.com/raycast/extensions/tree/e38232e713cc42a58cac81b8d3af9261fd1624e5/extensions/Splitwise/) | Other merged branch; included for completeness, already released. |
| [Calculate Anything](../workflows/z-calculate-anything) | — | [Alfred Calculate Anything](https://github.com/biati-digital/alfred-calculate-anything) | Bridge to the separately installed Alfred Calculate Anything engine; no Raycast reference. |
| [Workflow Manager](../workflows/z-workflow-manager) | — | [Alfred Gallery](https://github.com/alfredapp/alfred-gallery-workflow/) | Installed Alfred Gallery workflow and official catalog; no Raycast reference. |
| [Notion](../workflows/z-notion) | [Notion](https://www.raycast.com/notion/notion) | [Notion (459326f)](https://github.com/raycast/extensions/tree/459326f4f557692a79246dba2d013746f56d724b/extensions/notion/) | Other merged branch; included for completeness, already released. |
| [Translate](../workflows/z-translate) | [Google Translate](https://www.raycast.com/gebeto/translate) | [Google Translate (e38232e)](https://github.com/raycast/extensions/tree/e38232e713cc42a58cac81b8d3af9261fd1624e5/extensions/google-translate/) | Clipboard and text translation with native split panes |
| [Folder Navigator](../workflows/z-folder-navigator) | — | [Dynamic File Search](https://github.com/alfredapp/dynamic-file-search-workflow/) | Dynamic File Search workflow; external mounted SSD folders included. |
| [Tag Manager](../workflows/z-tag-manager) | [App Tag Manager](https://www.raycast.com/zaincheung/app-tag-manager) | [App Tag Manager (e38232e)](https://github.com/raycast/extensions/tree/e38232e713cc42a58cac81b8d3af9261fd1624e5/extensions/app-tag-manager/) | Also installed Tag Finder. Finder metadata across files/apps differs from upstream custom app tags. |
| [System Monitor](../workflows/z-system-monitor) | [System Monitor](https://www.raycast.com/hossammourad/raycast-system-monitor) | [System Monitor (86a5e3d)](https://github.com/raycast/extensions/tree/86a5e3dc08b9e9c30a9ef9c78228701ef375f3d6/extensions/system-monitor/) | Also the installed atop workflow; hardware values may be unavailable. |
| [Mole](../workflows/z-mole) | [Mole](https://www.raycast.com/jlrochin/mole) | [Mole (459326f)](https://github.com/raycast/extensions/tree/459326f4f557692a79246dba2d013746f56d724b/extensions/mole/) | Mole CLI plus user screenshots of Status/Clean/Optimize/Analyze. |
| [Dev](../workflows/z-dev) | — | Original launcher | Original launcher with five independently installed tools; not a Raycast extension port. |
| [Dev Servers](../workflows/z-dev-servers) | [Dev Servers](https://www.raycast.com/tavlean/dev-servers) | [Dev Servers (18750b5)](https://github.com/raycast/extensions/tree/18750b5bc7fe87eb76991e86f0cda47200daa48f/extensions/dev-servers/) | Inspect local servers and stop or restart by project |
| [Bluetooth](../workflows/z-bluetooth) | [Toothpick](https://www.raycast.com/VladCuciureanu/toothpick) | [Toothpick (c4e0f79)](https://github.com/raycast/extensions/tree/c4e0f79975a011e16032382f2d1263f712f8b43c/extensions/toothpick/) | Paired Bluetooth devices, connection controls and battery details |
| [Wi-Fi](../workflows/z-wifi) | [Toothpick — UI reference](https://www.raycast.com/VladCuciureanu/toothpick) | [Apple CoreWLAN](https://developer.apple.com/documentation/corewlan/cwinterface)<br>[Toothpick source — UI reference](https://github.com/raycast/extensions/tree/c4e0f79975a011e16032382f2d1263f712f8b43c/extensions/toothpick/) | Original Wi-Fi adaptation of the requested Toothpick interaction pattern; Apple APIs. |
| [Dev Cache Cleaner](../workflows/z-dev-cache-cleaner) | [Dev Cache Cleaner](https://www.raycast.com/Undolog/dev-cache-cleaner) | [Dev Cache Cleaner (e38232e)](https://github.com/raycast/extensions/tree/e38232e713cc42a58cac81b8d3af9261fd1624e5/extensions/dev-cache-cleaner/) | Inspect developer caches and review individual or safe bulk cleanup |
| [Dev Utils](../workflows/z-dev-utils) | [DevUtils](https://www.raycast.com/devutils/devutils) | [DevUtils (18750b5)](https://github.com/raycast/extensions/tree/18750b5bc7fe87eb76991e86f0cda47200daa48f/extensions/devutils/) | Raycast reference launches the external DevUtils app; local transforms also draw on Text Transformer. |
| [GIF Search](../workflows/z-gif-search) | [GIF Search](https://www.raycast.com/josephschmitt/gif-search) | [GIF Search (dccfc88)](https://github.com/raycast/extensions/tree/dccfc8877dd0e658295cb4b6d29b4a0a1b79baf8/extensions/gif-search/) | GIF search, favorites and recents; list/grid layouts |
| [Emoji Picker](../workflows/z-emoji) | [Emoji Search](https://www.raycast.com/FezVrasta/emoji) | [Emoji Search (e38232e)](https://github.com/raycast/extensions/tree/e38232e713cc42a58cac81b8d3af9261fd1624e5/extensions/emoji/) | Also Unicode 17.0 emoji-test data; list/grid behavior. |
| [Lunar Controls](../workflows/z-lunar) | — | [Lunar-fred](https://github.com/April-June-August/Lunar-fred) | Installed Lunar-fred, Lunar CLI and user screenshots; no Raycast source recorded. |
| [Window Navigator](../workflows/z-window-navigator) | — | [Window Navigator](https://github.com/zeitlings/alfred-workflows) | Alfred Window Navigator and Window Switcher references consolidated into one workflow. |
| [World Clock](../workflows/z-world-clock) | [World Clock](https://www.raycast.com/koinzhang/world-clock) | [World Clock (886cbd7)](https://github.com/raycast/extensions/tree/886cbd73fe377ad1d8f0c17083e6cd4c96748a33/extensions/world-clock/) | Offline timezones, starred locations and native analog grid |
| [Swiss](../workflows/z-swiss) | — | Original launcher | Original launcher and navigation protocol; individual tools carry their own references. |
| [Weather](../workflows/z-weather) | [Weather](https://www.raycast.com/tonka3000/weather) | [Weather (886cbd7)](https://github.com/raycast/extensions/tree/886cbd73fe377ad1d8f0c17083e6cd4c96748a33/extensions/weather/) | Saved cities, colorful conditions and detailed weather forecasts |
| [Maps](../workflows/z-map) | — | Screenshot reference; no source URL recorded | Other merged branch: Maps UX was screenshot-based; no upstream app source URL recorded. |

## Additional project and data links

| Related workflow | Link / reason |
| --- | --- |
| Bitwarden | [Bitwarden CLI](https://bitwarden.com/help/cli/); [original workflow repository](https://github.com/sk-izsk/z-bitwarden). |
| VS Code | [Alex Chan’s Alfred workflow](https://github.com/alexchantastic/alfred-open-with-vscode-workflow); [original workflow repository](https://github.com/sk-izsk/z-vscode-workflow). |
| Speed Test | [Ookla CLI](https://www.speedtest.net/apps/cli); [official Homebrew tap](https://github.com/teamookla/homebrew-speedtest); [EULA](https://www.speedtest.net/about/eula), [terms](https://www.speedtest.net/about/terms), [GDPR](https://www.speedtest.net/about/gdpr). |
| Weather | [wttr.in source](https://github.com/chubin/wttr.in); [Open-Meteo / CAMS air-quality API](https://open-meteo.com/en/docs/air-quality-api). |
| Adhan Time / Ramadan | [Aladhan API](https://aladhan.com/prayer-times-api); [calculation methods](https://api.aladhan.com/v1/methods). Dates are calculated; local moon sighting may differ. |
| Currency Exchange | [ExchangeRate-API overview](https://www.exchangerate-api.com/docs/overview); [open-access API / terms](https://www.exchangerate-api.com/docs/free); [UniRateAPI](https://unirateapi.com); [AllRatesToday ECB endpoint](https://allratestoday.com/api/open/central-bank/ecb). |
| Translate | [TRACTION google-translate transport](https://github.com/iamtraction/google-translate). |
| Tag Manager | [Alfred Tag Finder](https://github.com/FireFingers21/alfred-tag-finder), URL read from the installed reference workflow. |
| System Monitor | Installed `atop` workflow (`de.chris-grieser.atop`), whose metadata links to [Chris Grieser](https://chris-grieser.de/); no source-repository URL was recorded in that metadata. |
| Mole | [Mole CLI site](https://mole.fit). The separate CLI performs reviewed real actions. |
| Dev Utils | [DevUtils app](https://devutils.com); [Alfred Text Transformer](https://github.com/alfredapp/text-transformer-workflow/), URL read from the installed workflow. |
| GIF Search | [GIPHY API](https://developers.giphy.com/docs/api/endpoint/); provider behavior is described in the pinned GIF Search source. |
| Emoji Picker | [Unicode 17.0 emoji-test data](https://www.unicode.org/Public/17.0.0/emoji/emoji-test.txt). |
| Lunar Controls | [Lunar](https://lunar.fyi); [Lunar-fred](https://github.com/April-June-August/Lunar-fred); installed Lunar CLI help. |
| Window Navigator | [Alfred Window Switcher](https://github.com/alfredapp/window-switcher-workflow/) is the additional reference; the standalone duplicate was removed. |
| Maps — other branch | [Transitous](https://transitous.org), [FOSSGIS OSRM](https://routing.openstreetmap.de), [Photon](https://photon.komoot.io), [OpenFreeMap](https://openfreemap.org), [MapLibre](https://maplibre.org), [Google Maps Platform](https://mapsplatform.google.com), [HERE](https://www.here.com). |
| Splitwise — other branch | [Splitwise app registration](https://secure.splitwise.com/apps). |
| Notion — other branch | [Notion integrations](https://www.notion.so/my-integrations). |

## Canceled, deferred and consolidated requests

- **Standalone Password Generator — canceled:** [Raycast listing](https://www.raycast.com/joshuaiz/password-generator), [pinned source](https://github.com/raycast/extensions/tree/480c8790efdca370fda96f8f95bc914604e362d5/extensions/password-generator/). The user chose the existing Bitwarden generator instead; there is no separate workflow/release.
- **Window Switcher — consolidated:** its reference is retained above, but only Window Navigator is shipped.
- **Camera — deferred; Last Changed Files — canceled; menubar features — excluded.** These are not missing initial releases.

## Review guidance

Compare each implementation against the pinned source and supplied screenshots, then read the documented differences and requirements. Check navigation/Back/Escape, configuration and secrets handling, native-versus-WebKit choices, cache/cleanup activity and refreshed results, and external terminal routing. A successful build is not proof of identical UI or live hardware behavior. [Earlier feature verification and limits](FINAL_VERIFICATION.md) records the tests and non-destructive live checks; [initial release verification](INITIAL_RELEASES.md) covers the merged release commit.

The complete reference trail is also maintained in each workflow’s README and THIRD_PARTY_NOTICES.md. UI screenshots supplied in the conversation are design evidence, not executable instructions.
