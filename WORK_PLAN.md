# Swiss utilities work plan

Work continues on `feature/kill-process-workflow`, PR #9 into `dev`. Keep each utility independently installable, with its own keyword and an optional Swiss entry. Commit and push completed phases on this same branch. Do not wait for a new branch between phases.

## Completed and pushed

- [x] Merge the latest requested `dev` changes, preserving Bitwarden hardening.
- [x] Kill Process, with immediate termination and process identity checks.
- [x] Weather: split layout, current conditions in city rows, forecast controls, AQI, condition icons and configurable refresh.
- [x] Adhan: prayer times and Ramadan timetable; Gregorian year picker, fresh API requests, fetch timestamps, calculated-date disclosure, city-local Today marker.
- [x] Currency: broad default currency coverage including BDT, configurable refresh and stable typing.
- [x] Calculate Anything bridge: installed engine and preferences, stable typing.
- [x] World Clock: offline list/grid, starred zones, aliases, details and Swiss Back.
- [x] Workflow Manager: installed/available/update filters, verified Gallery/repository sources, native installer queues, configuration/removal actions and contextual empty states.
- [x] Translation: clipboard on empty invocation, editable original and translated split panes, two language dropdowns, pronunciation, 50,000-character sequential translation with progress/continue, stable typing and Swiss Back. Keep the window near its original size with tighter footer spacing; overflowing panes scroll.
- [x] Refresh controls/audit for Weather, AQI, Currency, Adhan, Brew catalog/details and GitHub GET cache; see API_REFRESH.md.

## In progress

- [x] Folder Navigator: native folder descent/Back and external SSD list verified, docs/screenshots and Swiss registration complete. Source is in `workflows/z-folder-navigator`. Initial Spotlight folder search, full paths, directory browsing, file opening, complete Back history and native file icons. Installed reference: Dynamic File Search.

## Shared UI changes requested

- [x] Weather city high/low values and standard 780 width, native list/details verified.
- [x] Folder Navigator: configurable Hyper+B, modifier checkboxes, compact footer labels and screen-aware 780 width; shared helper and UI_CONVENTIONS.md available for each new workflow.
- [x] Migrated all 22 workflows / 40 windows to the shared width/Hyper convention, preserving explicit legacy shortcuts. Checks/package and bare-environment profiles passed; native Weather and Calendar widths/footers verified.

## Remaining Swiss work, in order

- [x] Tag Manager: native Finder metadata across files/folders/apps; search, add/remove, reviewed merge import/export, native file actions, shared 780/Hyper profile. Temporary-file metadata tests and native editor/menu verified. Fixed global discovery across indexed system/external volumes; live Paid search verified 29 matching apps.
- [x] System Monitor: native live overview/CPU/memory/disks/power/network dashboard, per-core and per-process rates, shared UI profile, checked/packaged and native overview verified. Sensors without a supported provider are explicitly unavailable.
- [x] Mole: actual installed CLI status, disk analysis, cleanup/optimization dry-run previews, explicit review and Terminal execution for real changes. Native status verified; no cleanup was performed.
- [x] Emoji Picker: bundled Unicode 17 data (3,944 sequences), native search/categories, favorites/recents, variants, copy/paste actions; tests and native search verified.
- [x] Lunar Controls: installed Lunar-fred/CLI verified; brightness/contrast/volume sliders with live labels, percentage shortcuts, modern input/adaptive/preset selectors, global adaptive modes, saved presets and reviewed power actions. Display-row clicks select controls instead of opening Lunar. Read-only native UI verified; physical settings were not changed for testing.
- [x] Window Navigator: global/active/current-desktop scopes, native search and app icons, focus/close/quit actions, revalidation and Swiss Back. Native list verified; disposable TextEdit raise/close verified.
- [x] Consolidated Window Switcher into Window Navigator per user request. `wins` opens Current Desktop mode in the same workflow; the separate project/Swiss entry is removed. Stage Manager visibility matches app/title as well as full-size geometry, with a count-checked fallback for stale thumbnail titles; real enumeration improved from one to six windows.
- [x] Emoji: selectable list/grid layout, preserving search/category/selection; four tests and check/package pass.
- [x] GIF Search: pinned providers checked; standalone `gifsearch` under Swiss, remembered list/grid, side-by-side selectors, favorites/recents and contextual actions. Live GIPHY search/previews and compact native grid verified; direct key optional.

## Dev launcher phase (after Swiss)

- [ ] Dev launcher: separate searchable launcher using the same independent-tool and Back protocol as Swiss. These utilities belong only to Dev.
- [ ] Dev Servers: project grouping, tool filter, open/copy URL, stop/restart, Terminal/Finder actions, project/all-server stopping. Verify process identity before stopping; never stop real servers merely for testing.
- [ ] Bluetooth: connect/disconnect, device type/battery/details and actions; verify macOS API/permission support first.
- [ ] Wi-Fi: analogous network controls/details; verify current macOS scanning/permission restrictions before implementation.
- [ ] Dev Cache Cleaner: scan sizes, categories and risk filters; split details view, individual cleanup and safe-cache cleanup review. Never perform a cleanup just to verify the UI.
- [ ] Dev Utils: pinned Raycast devutils plus installed Textformer reference; integrate supported text/developer transformations.

- [x] Canceled standalone Password Generator at user request; use the existing Bitwarden generator. Original scope: pinned Raycast reference plus existing Bitwarden generator; local cryptographic generation, length/character controls, copy/regenerate actions, no password cache persistence.

## Shared completion checks

Every new utility needs Configuration Builder settings, visible configurable Back (default Hyper+B (Control+Option+Shift+Command+B)) in every footer/sheet, Cmd-K actions from the supplied references, theme-aware controls, icons/notices, README/screenshots, appropriate tests, check/package, local installation and Swiss integration. Back restores each previous screen/query/selection. Do not put Back in Actions. Generate ui.json and info.plist from TypeScript. Keep private settings/caches/build bundles/dependencies out of Git. Do not modify the unrelated `.omc/` directory.

Camera is deferred. Last Changed Files is canceled. Menubar features are excluded.

## Pinned references

- Adhan, Currency, Google Translate, App Tag Manager, Emoji and Dev Cache Cleaner: Raycast extensions commit `e38232e713cc42a58cac81b8d3af9261fd1624e5`.
- Weather and World Clock: `886cbd73fe377ad1d8f0c17083e6cd4c96748a33`.
- System Monitor: `86a5e3dc08b9e9c30a9ef9c78228701ef375f3d6`.
- Mole: `459326f4f557692a79246dba2d013746f56d724b`.
- Dev Servers and Dev Utils: `18750b5bc7fe87eb76991e86f0cda47200daa48f`.
- Toothpick Bluetooth reference: `c4e0f79975a011e16032382f2d1263f712f8b43c`.
- Password Generator: `480c8790efdca370fda96f8f95bc914604e362d5`.
- Dynamic File Search: https://github.com/alfredapp/dynamic-file-search-workflow/

- GIF Search reference: `dccfc8877dd0e658295cb4b6d29b4a0a1b79baf8`.
