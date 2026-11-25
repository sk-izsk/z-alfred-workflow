# Validation

`bun run check` covers type checking, lint, formatting and nine tests: provider parsing, clock formats,
unknown times, city timezone/DST, Sunrise exclusion, after-Isha tomorrow, month rollover, method IDs,
input validation, stale cache fallback, actual-next-prayer preservation while browsing, unique native
IDs, root Back and Actions contents. Tests use temporary data/cache directories and mocked HTTP.

The bundled CLI was run in a bare environment against the real Aladhan calendar for a public example
city. The linked local Alfred screen was captured to verify native two-column layout, prayer rows,
countdown, method/school/timezone and footer actions. The screenshot contains a public example city.

Before release, interactively check Settings save/error/back, custom Back shortcuts, all date arrows,
Command-K actions, midnight/month transition while left open, light/dark/custom themes, and offline
first launch versus cached refresh. Captures and CLI tests do not prove every keyboard/focus transition.

Packages must exclude prefs.plist, caches, user settings, node_modules and development files. Include
MIT notices with the icon. Run the Alfred UI checker and XML plist validation after generation.
