# Calendar workflow

- Run Bun commands here. Preserve `com.izsk.calendar` and configurable `cal`, `cald`, `calq`, `calc` defaults.
- Generate windows and metadata from `ui/` and `scripts/plist.ts`.
- Calendar data goes through EventKit in `scripts/eventkit.js`; keep the bridge plain JXA, without Node imports.
- Event form fields go through UI variables/environment, then stdin to the bridge. Never interpolate data into code.
- Do not log calendar contents, place private events in fixtures, or modify real calendars in automated tests.
- Keep the Raycast icon credits and MIT notice in the exported package.
- Run `bun run check` and `bun run package`; see TESTING.md for on-screen verification.
