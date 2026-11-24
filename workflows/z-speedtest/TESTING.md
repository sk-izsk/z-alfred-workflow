# Verification

Run from this workflow directory:

```sh
bun run check
bun run package
python3 /path/to/alfred-ui/scripts/check_ui.py workflow
plutil -lint workflow/info.plist
unzip -l 'dist/Speed Test.alfredworkflow'
```

The tests exercise fragmented and combined JSON output, final lines without newlines, partial
latency data, progress zero, invalid values, URL validation, HTML escaping, source quality
thresholds and every metadata view. A fake executable supplies Ookla-shaped events for worker
and action-route checks in a bare environment. These cover restart, offline errors, missing CLI,
cache clearing without deleting the CLI, close cancellation and lock cleanup without network use.
They do not measure actual network performance.

For manual runtime checking, work inside `workflow/speedtest.alfredui` and run `../bin/spt start`
with a bare environment and an explicit cache path. Copy the returned `variables.session` into
subsequent commands (`poll`, `view`, `details`, `select`, `actions`, `copy-summary`, `copy-section`,
`open`, `clear-confirm`, `cancel`). Each non-empty stdout response must parse as one JSON action.
Do not invoke image copy/paste/save unless you intend its clipboard or Downloads side effect.

Before release, install the package and check in Alfred:

- Launch by keyword, optional hotkey and external trigger, inside Alfred and in a separate window.
- Confirm window size, transparent web content, light/dark charts and all labels at normal scaling.
- Verify live blue download and purple upload meters, sample charts and active phase strip.
- Command-L: switch views without starting another CLI; close/reopen remembers the chosen view.
- Search and arrows: filter and select all nine sections; Return toggles details and preserves selection.
- Check raw ISP/server/ping/speed/result metadata, latency range charts and loaded-latency charts.
- Command-K actions, copy summary/section and open-result URL.
- Complete a real test, restart, and close during a test: no overlapping or orphan CLI processes.
- Go offline: error appears; reconnect and Return restarts with no stale error or samples.
- Copy/paste/save PNG; confirm it is a real PNG, readable in light/dark appearance and named uniquely.
- Clear CLI Cache confirmation/cancel, then restart. Confirm the installed CLI remains present.

Real Ookla testing, Alfred rendering/focus/shortcuts and clipboard/paste permissions require a
Mac with the CLI and Alfred. They are not established by the fake-CLI checks.

## Checks performed during implementation

- `bun run check`: 10 passing tests, TypeScript, lint and formatting checks pass.
- `bun run package`, UI checker and XML plist validation pass. Archive contents inspected.
- Bundled launcher run from the UI directory with `env` limited to HOME, system PATH and a
  temporary cache: action outputs parse correctly and missing-CLI errors appear.
- One complete real Ookla CLI 1.2.0 test through the bundled launcher: 38 download samples,
  55 upload samples and a validated Speedtest result URL. Private snapshots remain outside Git.
- Demo dashboard rendered and visually inspected using WebKit. Demo meter SVG rendered and
  visually inspected using macOS QuickLook. These are previews, not screenshots of Alfred.
- Alfred window layout/focus/shortcuts and clipboard/paste/save actions remain unverified on screen.

The user confirmed the workflow appears and launches after linking it into the active Alfred
preferences and reloading by its folder identifier. Other on-screen checks above remain manual.
