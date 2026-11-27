# Notion

- Independent Bun + TypeScript project; generate UI/plist and preserve `com.izsk.notion`.
- One window with a screen stack in `state.json`; `back` pops one level, the first level finishes
  to Alfred's search. Search and database filtering update only the list rows (a replaced text
  field loses its cursor).
- The integration secret lives only in the Keychain and reaches scripts through `nt_key`, never
  argv, prefs.plist or the cache.
- API calls use the official SDK with data sources (`dataSourceId` resolves old database ids).
- `nt_demo=1` shows the cache without Keychain or network, only for README screenshots with the
  synthetic data in `tests/fixtures.ts`. Never commit real pages, names or secrets.
- Run check, package and the Alfred UI checker (also on runtime screens).
