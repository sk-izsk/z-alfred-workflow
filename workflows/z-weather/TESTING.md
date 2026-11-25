# Validation

`bun run check` covers TypeScript, lint, formatting and 22 tests: query/schema validation, resolved
locations, current versus forecast temperature fields, metric/imperial measurements, unknown values,
condition icons, forecast hours, saved-city add/remove, native screen IDs, Back/selection restoration,
direct-launch return, date bounds, cache reuse, stale fallback and first-fetch failure. Additional checks
cover native left-column forecast containment, distinct vertical detail rows, bounded pagination,
forecast tab/date resets, day/night icons, AQI thresholds, null pollutants and AQI cache fallback.

`bun run package`, XML plist validation and the Alfred UI checker pass. The bundled launcher was
run from the .alfredui directory with only HOME, system PATH, a public London query and temporary
Alfred cache/data paths. It fetched real provider data and populated weather measurements. AQI was also fetched from Open-Meteo.

The workflow was linked and opened in Alfred. Targeted captures verified the split layout, readable right-side rows including AQI, native forecast
cards entirely inside the left column, bottom arrow controls, absence of WebKit backgrounds and
scrollbars, unit/date pickers and visible footer Back/Actions. Pagination and tab changes were
validated through the same bundled CLI commands used by the buttons.
The README screenshot uses a public London example, not a private saved location. Actual keyboard
focus, all modal transitions and every available forecast date still need interactive verification;
CLI outputs and captures alone do not establish those interactions.

Before release, check:

- Multiple predefined cities, Add/Save/Remove/restore, name filtering and country disambiguation.
- City list → report → Back restores the query/selection. A direct query returns to Alfred search.
- Current versus another date’s noon forecast; hourly local time slots and rain probabilities.
- Metric/imperial conversions, missing measurements, long city names and narrow window sizes.
- Command-K contains all documented actions; copy/open actions occur only when selected.
- Sheet Back closes only the sheet; custom Back shortcut and light/dark/custom Alfred themes.
- Refresh while offline shows cached/stale data clearly, or an error if no report exists.
- Archive excludes preferences, caches, dependencies and private location data.
