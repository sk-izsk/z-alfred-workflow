# Splitwise

- Independent Bun + TypeScript project; generate UI/plist and preserve `com.izsk.splitwise`.
- One window with a screen stack in `state.json`; `back` pops one level, the first level finishes
  to Alfred's search. Sheets (receipt, delete) close to their screen.
- The API key lives only in the Keychain (`security -i` over stdin) and reaches scripts through the
  `sw_key` environment variable, never argv, prefs.plist or the cache.
- Shares must add up to the cost to the cent (`friendSplit`, `equalSplit`); keep those tests.
- `sw_demo=1` shows the cache without Keychain or network, only for README screenshots with the
  synthetic data in `tests/fixtures.ts`. Never commit real names, balances or keys.
- Run check, package and the Alfred UI checker (also on runtime screens).
