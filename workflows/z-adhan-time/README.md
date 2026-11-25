# Adhan Time for Alfred

City-local prayer times, next-prayer countdown and daily calendars in a native Alfred 6 window.
Inspired by [Raycast Adhan Time](https://github.com/raycast/extensions/tree/e38232e713cc42a58cac81b8d3af9261fd1624e5/extensions/adhan-time), with data from [Aladhan](https://aladhan.com/prayer-times-api).

![Prayer calendar and next prayer](assets/screenshots/prayer-times.png)

Requires macOS, Alfred 6 Powerpack, Node.js 22+ or Bun, and internet for uncached calendars. No API key.

## Use

Type **`adhan`**. On first launch, Settings asks for your city and country. Choose the calculation method
and Asr school used by your mosque; the default method is ISNA and school is Standard. Select Hanafi
when appropriate. The clock supports 12-hour and 24-hour formats.

You can also type **`adhan Toronto, Canada`** to view another city without saving it. In-window Settings
persist in Alfred's workflow data and override Workflow Configuration defaults. Edit Settings again
to change them. The workflow does not request device location or infer your religious preferences.

The left pane shows the next prayer using the city's timezone and a countdown refreshed every 30 seconds
while open. The right pane shows the selected Gregorian/Hijri date and Fajr, Sunrise, Dhuhr, Asr, Maghrib
and Isha. Sunrise is informational; it is excluded from the next-prayer countdown. After Isha the next
prayer is tomorrow's Fajr, including the next month when available. Browsing another date keeps the
countdown anchored to the actual current day.

| Shortcut | Action |
| --- | --- |
| ← / → | Previous / next date |
| ⌘R | Refresh selected calendar |
| ⌘K | Open Actions |
| ⌘[ | Configurable Back; sheets return to their parent |

Today returns to the current date in the city's timezone. **Actions** contains Today, Previous Day,
Next Day, Copy Daily Prayer Times, Calculation Details, Settings, Refresh Calendar and Open Aladhan.
Back is always visible in the footer and stays outside Actions. Direct launch Back returns to Alfred
search. The `open` external trigger accepts `City, Country` for the future Swiss launcher.

## Data and calculation

Calendars cache for 24 hours by city/country, method, school and month. Refresh bypasses the cache;
failed refresh retains and explicitly marks the cached calendar. Missing times and unavailable future
calendars remain unknown rather than reusing yesterday's times. Dates and timezone come from Aladhan.
The method dropdown uses IDs verified against [Aladhan's methods endpoint](https://api.aladhan.com/v1/methods);
these correct mismatches in several labels in the pinned Raycast reference.

These are calculated times and may differ from your mosque's timetable. Confirm method and school
locally. Hijri dates follow the provider's calendar. The workflow does not play audio, schedule alarms
or run a background service when closed. City/country and your public IP are visible to Aladhan.
Settings and cache stay in Alfred's local workflow directories.

## Development

```sh
bun install --frozen-lockfile
bun run check
bun run package
bun run link
```

Output: `dist/Adhan Time.alfredworkflow`. Releases use `z-adhan-time/vX.Y.Z`.
UI and metadata are generated from `ui/window.ts` and `scripts/plist.ts`.
See [TESTING.md](TESTING.md) for verification and interactive checks.

## Credits

Icon/reference: Raycast Adhan Time by mzaien, menisy, YourMCGeek and contributors, MIT.
Prayer calculations: Aladhan. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [LICENSE](LICENSE).

Built with help from AI tools. Review before use and report issues on the
[project tracker](https://github.com/sk-izsk/z-alfred-workflow/issues).
