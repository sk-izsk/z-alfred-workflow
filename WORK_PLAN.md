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

## Completed navigation phase

- [x] Folder Navigator: native folder descent/Back and external SSD list verified, docs/screenshots and Swiss registration complete. Source is in `workflows/z-folder-navigator`. Initial Spotlight folder search, full paths, directory browsing, file opening, complete Back history and native file icons. Installed reference: Dynamic File Search.

## Shared UI changes requested

- [x] Weather city high/low values and standard 780 width, native list/details verified.
- [x] Folder Navigator: configurable Hyper+B, modifier checkboxes, compact footer labels and screen-aware 780 width; shared helper and UI_CONVENTIONS.md available for each new workflow.
- [x] Migrated all 22 workflows / 40 windows to the shared width/Hyper convention, preserving explicit legacy shortcuts. Checks/package and bare-environment profiles passed; native Weather and Calendar widths/footers verified.

## Completed Swiss phases

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

- [x] Dev launcher: separate `dev` keyword with five trusted tool entries, installation/version checks and its own return-session protocol. These utilities belong only to Dev. Checked, packaged and installed.
- [x] Dev Servers: independent keyword and Dev return protocol; checked/packaged, disposable server detection/stop verified. Implemented scope: project grouping, tool filter, open/copy URL, stop/restart, Terminal/Finder actions, project/all-server stopping. Verify process identity before stopping; never stop real servers merely for testing.
- [x] Bluetooth: independent workflow installed; native metadata verified (12 paired), check/package passed; connection changes left untested on user devices. Implemented scope: connect/disconnect, device type/battery/details and actions; verify macOS API/permission support first.
- [x] Wi-Fi: native report/status and saved networks, privacy-aware current row; checked/packaged and installed. No live connection/power changed. Implemented scope: analogous network controls/details; verify current macOS scanning/permission restrictions before implementation.
- [x] Dev Cache Cleaner: checked/packaged; scope/identity tests and live read-only scan passed; no real cache removed. Implemented scope: scan sizes, categories and risk filters; split details view, individual cleanup and safe-cache cleanup review. Never perform a cleanup just to verify the UI.
- [x] Dev Utils: local transformations, clipboard input, split editors, no text persistence and optional DevUtils app handoff; checked/packaged. Implemented scope: pinned Raycast devutils plus installed Textformer reference; integrate supported text/developer transformations.

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

## Screenshot fidelity correction

- [x] Mole: implemented with native Alfred controls: status split dashboard, grouped cleanup/optimization summaries and full-width disk browser with size badges. Native five-mode comparison and loading regression checks completed.
- [x] Review supplied screenshots when verifying each affected workflow; do not substitute a generic layout. Rule recorded in UI_CONVENTIONS.md.

## Completed reference audit

All requested reference layouts, controls and Actions were reviewed. The four identified gaps are corrected: native tag pills, System Monitor sections/badges, Dev Servers project headings/uptime, and Bluetooth battery accessories. Dev Cache Cleaner uses grouped native list/details and a consistent cleanup footer. Weather’s excess height and oversized sheet contents were reduced.

See [docs/FINAL_VERIFICATION.md](docs/FINAL_VERIFICATION.md) for the per-workflow test counts, native evidence, command checks and verification limits. All 29 active projects pass checks and packaging; 333 tests pass. No agreed implementation tasks remain. Camera, Last Changed Files, standalone Password Generator and menubar features retain their earlier excluded/deferred status.

## Web view audit

All 29 workflow projects searched. Mole uses native lists/details and has no web view. Speed Test connection errors moved to native controls. Retained only Lunar sliders, Speed Test charts, VS Code rich HTML extension preview and animated GIF details, with reasons in UI_CONVENTIONS.md. VS Code dynamic preview width reduced to the shared 704-point content width.

## Completion

- [x] Finish the reference layout/action correction pass and shared footer/Escape behavior.
- [x] Verify Mole's five native modes and real read-only Clean System loading/completion without an automatic close command.
- [x] Verify Dev descriptions/icons, paired Bluetooth discovery and privacy-aware Wi-Fi association.
- [x] Add configurable terminal routing to every terminal-opening workflow, including Ghostty.
- [x] Complete all 29 project checks/packages, plist/UI validation and package exclusion checks.
- [x] Record validation scope and intentionally untested destructive/credential operations.

## November 26 regression fixes

- Mole previews now use a separate CLI worker and short native polling; stdin closes, CLI execution is bounded, and a watchdog replaces stalled loading with an error. Installed Optimize preview visually verified through completion.
- Wi-Fi association uses ipconfig metadata when system_profiler omits the current connection. Read-only verification: one connected network, name redacted by macOS. Saved Password action uses Keychain authentication and an ephemeral native dialog; no password retrieval or network mutation was performed during testing.
- Cache Cleaner now follows the grouped list/Markdown detail reference, counted filters and risk dots. Expanded manager/language/app/Xcode/Apple simulator/Android snapshot/Docker coverage; real scan found 15 entries. npm root-cache layout fixed; absent Homebrew cache stays visible. Available simulator storage is never counted as reclaimable. Native grouped/detail view visually verified; no deletion performed.
- Dev keyword source and installed metadata have the corrected description; workflow reloaded to refresh Alfred's metadata. Actual Alfred search description visually verified.

- Footer correction: sheet Back aligned right in 27 workflow helpers. Cache review now places Back/Clean together in a borderless footer, Return triggers Clean, and Escape dismisses the sheet without cleanup (verified in the installed native window). Convention recorded for future screens.

- Cache cleanup activity: confirmed jobs run separately, show Cleaning/Refreshing phases and block duplicate actions. Fresh measurements replace the results after success or partial failure; tests cover refreshed totals and disappearing filters. Real cleanup remains untested.

- Final pass: shared sheet implementation prevents footer/Escape drift; tag/metric/project/battery layouts corrected; terminal configuration centralized; read-only Mole progress verified with no finish action. Detailed evidence and limits are in docs/FINAL_VERIFICATION.md.

- Currency follow-up: three configured base currencies appear as pinned quick buttons above results; the compact base chooser opens local code/name/country search. Row Actions add/remove quick favorites, warn at the three-item limit, and persist choices. Currency-only checks and packaging passed.
