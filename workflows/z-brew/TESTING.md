# Validation

`bun run check` runs TypeScript, Oxlint, formatting checks and 23 Bun tests covering metadata,
warning precedence, search, adoption matching, command validation, quoting, mixed upgrades, pinned
and disabled exclusions, report coverage, window wiring and the review/dispatch boundary. Tests
never run package-changing commands. `bun run package` builds the nine native Alfred windows and
checks metadata generation with macOS plutil.

## Verified locally

Read-only commands ran from a generated .alfredui directory with only HOME, PATH=/usr/bin:/bin and
temporary Alfred cache/data paths. Installed packages, search, upgrades, adoption candidates,
services, taps, Doctor and vulnerability reports returned valid JSON UI actions against Homebrew
7.0.16. Initial search queries and the result cap were checked. Search fetched Homebrew’s public
catalog; vulnerability scanning used its advisory sources. Homebrew can write its metadata cache
even for read-only commands.

The development workflow was linked into Alfred. Targeted captures confirmed native rendering of
the installed list, disabled warning icon/text, version truncation and search/details split. No
capture of the user’s package list is included in this repository. Archive inspection confirmed
nine UI bundles, the launcher/runtime, icon and license notices, with no local preferences, caches,
test data, dependencies or development source.

Menu and confirmation JSON were exercised through the CLI, including an execute action returning
only the workflow continuation. Live keyboard/menu interaction could not be automated because
macOS denied System Events keystrokes. Actual install, upgrade, uninstall, pin/unpin, adoption,
service changes, tap changes, update and cleanup were not performed. Terminal/iTerm dispatch and
successful completion of a real package operation remain manual checks.

## Manual checks before release

- Open `brew`, search the command menu and verify every direct keyword.
- In `brewi`, use arrows, Return, Command-K, type/status filters and Command-R. Check warning reasons
  and long descriptions/versions. Switch between light/dark and custom Alfred themes.
- In `brews git`, confirm initial query, type filtering and details as selection changes. Try a
  missing query and a catalog refresh while offline; an error should appear without changing packages.
- In `brewu`, toggle selections, deselect all and review an upgrade. An empty selection must fail;
  pinned/disabled entries cannot be selected for upgrading. Cancel the confirmation.
- In `brewa`, preview a candidate, ignore it, switch to Ignored and restore it. Preview is advisory;
  Homebrew can refuse an adoption. Check an empty candidate list.
- In `brewt`, review Add Tap even when no taps are installed, then cancel. Review service actions
  without running them. Inspect Doctor and vulnerability reports and copy their text.
- Choose a disposable package for a real install/upgrade/uninstall test, review its command and
  select Run in Terminal. Confirm Terminal opens and handles interaction. Repeat with iTerm if used.
  Refresh after completion; no automatic success claim should appear.
