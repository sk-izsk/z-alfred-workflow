# Verification

Seven tests cover arithmetic precedence and rejected code/depth/division errors, query/date parsing,
positive numeric rates, historical-date verification, cross-rates, currency/country filtering, pinned
order, cache/stale behavior, unsupported keyless history, native IDs, Back, date sheet and reference
Actions. Tests use temporary directories and mocked HTTP; no real API key is needed.

`bun run check`, `bun run package`, XML plist validation and the Alfred UI checker must pass.
The no-key endpoint was fetched live. Local Alfred captures verify the expression field, base picker,
flag icons, converted values, pinned ordering, country names and footer. The bundled CLI was run in
a minimal environment with temporary data/cache paths. Keyed latest/history requests are unverified
without credentials; a matching provider date is required before displaying historical data.

Before release, interactively verify typing/filter focus, picker changes, pin/copy actions, date sheet
save/error/Back, custom shortcuts, offline refresh, themes and unavailable-base errors. Inspect the
archive for prefs.plist, keys, caches, dependencies and development files.
