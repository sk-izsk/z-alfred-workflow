# Verification

Nine main tests plus two Swiss navigation tests cover arithmetic precedence and rejected code/depth/division errors, query/date parsing,
positive numeric rates, historical-date verification, cross-rates, currency/country filtering, pinned
order, cache/stale behavior, unsupported keyless history, native IDs, Back, date sheet and reference
Actions. Tests use temporary directories and mocked HTTP; no real API key is needed.

`bun run check`, `bun run package`, XML plist validation and the Alfred UI checker must pass.
Both no-key endpoints were fetched live. Open Access returned 166 currencies, including BDT. Typing checks verify results update without rebuilding/refocusing the query field. Local Alfred captures verify the expression field, base picker,
flag icons, converted values, pinned ordering, country names and footer. The bundled CLI was run in
a minimal environment with temporary data/cache paths. Keyed latest/history requests are unverified
without credentials; a matching provider date is required before displaying historical data.

Before release, interactively verify typing/filter focus, picker changes, pin/copy actions, date sheet
save/error/Back, custom shortcuts, offline refresh, themes and unavailable-base errors. Inspect the
archive for prefs.plist, keys, caches, dependencies and development files.

Currency-only follow-up: 13 tests / 75 assertions pass, including three configured base buttons, code/name/country search, local switching without clearing the amount/query, the searchable sheet’s Back/Escape behavior, and persisted row favorites with a strict three-item warning, and direct chooser star toggles that preserve search and keep the sheet open. Check/package/UI validation passed; other workflows were not rerun locally for this addition.
