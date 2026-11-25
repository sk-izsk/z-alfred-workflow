# Data refresh and cache policy

Cache expiry controls when the workflow may request data again. It does not change how often the upstream provider publishes observations or rates. Cached fallbacks retain their original timestamps and are marked stale after a failed refresh. Refresh actions bypass the cache.

| Workflow | Default | Configuration and behavior |
| --- | --- | --- |
| Weather | 10 minutes | `cache_minutes`; saved-city rows load conditions without opening details. `auto_refresh` checks while the UI is open. |
| Weather AQI | 15 minutes | `aqi_cache_minutes`; AQI is independent of weather observations and displays its observation time. |
| Currency | 60 minutes | `cache_minutes`; `auto_refresh` checks while open. Provider publication dates remain visible; the default open-access provider publishes daily. |
| Adhan and Ramadan | 24 hours | `cache_minutes`; requests on opening a calendar, with manual Refresh for prayer times. Calculated dates and city timezone come from Aladhan. |
| Brew catalog | 6 hours | `catalog_cache_minutes`; installed packages come from the local Homebrew CLI. |
| Brew details | 15 minutes | `detail_cache_minutes`; Check for Updates bypasses relevant caches. |
| GitHub REST | 30 seconds | `api_cache_seconds`; caches GET responses only. GraphQL and mutations are not cached. No background polling. |
| Calculate Anything | Original engine settings | The bridge reads the installed engine's preferences, including its currency cache settings; it does not introduce a second currency cache. |
| Bitwarden | Existing sync policy | Sync on opening, when enabled and older than five minutes. This phase preserves the vault's existing security and sync behavior. |
| Speed Test | On demand | Each new measurement runs the provider; history is explicitly historical. |
| Calendar | Local EventKit | Reads macOS Calendar; account synchronization is managed by macOS. |
| World Clock | Offline | Uses system IANA timezone rules and the current clock; no API requests. |

Minute settings accept 1–10080; invalid settings fall back to the documented default. GitHub accepts 1–604800 seconds. Automatic refresh stops with the UI; it does not run a background service. A more frequent fetch cannot make a daily provider publish hourly data.
