# Verification

Ten tests cover DST transitions at a fixed instant, Nepal/India fractional offsets, date rollover,
12/24-hour formatting, country/city/alias/memo search, invalid zones, persistent duplicate/edit IDs,
valid transparent RGBA PNG generation, hand positions, focus-preserving data updates, minute tick
suppression, native list/grid IDs, reference Actions and sheet/root Back. Swiss v1 parsing/return
validation is included. Tests use temporary directories and do not touch real user stars or avatars.

Run check, package, UI checker and plist validation. The bundled launcher is also run from the UI
folder with a minimal environment and temporary data/cache paths. There are no backend API requests.

The live Swiss → World Clock → Back path restores the launcher’s `clock` search.

Local Alfred captures verify list and analog-grid rendering, live dates/offsets, starred ordering,
filter/layout controls and visible Back/Actions. Layout switches update the cell design; typing and
timers only update row data. Register navigation shortcuts in the original UI definition; setting
them in the first root-component update was rejected by Alfred.

Before release, exercise star/edit/duplicate/move persistence, avatar deletion fallback, clock/date
preferences, all four grid arrows, custom shortcuts, search cursor behavior, sheet Back and Swiss
return restoration in the UI. Confirm packages contain no prefs.plist, stars, avatars, faces, session
files, dependencies or compiled development artifacts beyond the packaged runtime bundle.
