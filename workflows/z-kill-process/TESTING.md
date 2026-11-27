# Validation

Run `bun run check`, `bun run package`, then
`python3 <alfred-ui skill>/scripts/check_ui.py workflow` and
`plutil -lint workflow/info.plist` on macOS.

Automated tests cover ps parsing (including paths with spaces), the latest CPU sample, physical RAM
calculation and missing-data handling, literal search/sorting, process identity and protection,
exact executable groups, reviewed target snapshots, SIGTERM/SIGKILL selection, plan expiry, app
restart after exit, permission failures, ancestor loops, native meters and Back bindings.

Read-only live sampling ran through `workflow/bin/kproc` from the UI folder with a minimal PATH
and temporary cache/data directories. Process rows, CPU/RAM values and Actions JSON were checked.
SIGTERM and SIGKILL were then exercised against disposable `/bin/sleep` children created specifically
for testing, by exact PID/start identity. Immediate mode and optional confirmation mode both exited with the expected signals. In review
mode, children stayed alive until execution, and a second execute was rejected. No existing user process was terminated.

The workflow was linked and opened in Alfred. Targeted captures verified live meters, app icons,
path truncation, process count and sort-picker spacing. The README capture is filtered to Safari
and contains only standard system executable paths. Group/force-restart behavior is covered by fake
drivers; no real app was restarted. Native shortcut focus and all menu/sheet transitions still need
interactive verification; generating a menu response alone is not proof of keyboard behavior.

Before release, check:

- Search by name/PID/path; switch CPU/memory sorting and confirm selection stays during refresh.
- Use arrows, Return, Command-K, all documented action shortcuts, and manual Reload.
- Verify each screenshot action exists for app processes, with restart hidden for background tasks.
- Cancel or Back from review/details to the same filtered list; no signal should be sent.
- Review exact target PIDs for Kill All. Cancel; do not test against real apps with unsaved work.
- Test normal and force termination only with disposable children. Check exited/reused PID errors.
- Pause/resume auto-refresh; interval 0; missing metrics show dashes; no work persists after close.
- Switch Alfred themes and use a narrow window; no paths, counts or footer controls should overlap.
- Inspect the package for prefs, caches and dependencies; all must be absent.
