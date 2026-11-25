# Manual verification

Use a temporary local test calendar and demo events. Never commit preferences or private screenshots.

- [ ] `cal` shows all three commands; `cal create`, `cal quick`, `cal upcoming` filter them.
- [ ] `cald`, `calq`, `calc` directly open their views; changed keywords work through Configuration.
- [ ] Upcoming events loads all configured accounts, distinguishes identically named calendars and filters by calendar.
- [ ] ↑/↓ selection and search stay responsive; ⌘K exposes actions for the selected event.
- [ ] ↩ opens Meet/Zoom links, multiple links produce a choice, missing links open Calendar on that day.
- [ ] Ongoing, recurring and all-day events appear; cancelled/ended events do not.
- [ ] Meetings only hides holidays; Timed events includes in-person meetings; All events restores all-day entries.
- [ ] Empty calendars and permission denial have clear states; Allow Access + ⌘R recovers.
- [ ] Plain ←/→ moves one day and ↑/↓ one week, crossing month/year boundaries and refreshing the day preview.
- [ ] ⌘←/⌘→ changes month and ⇧←/⇧→ changes year; ⌘K hints match.
- [ ] Quick Calendar handles leap February and December/January, month/year arrows, today, Monday/Sunday and week numbers.
- [ ] Selected-day preview is hidden on empty days; on populated days it shows the appropriate meeting, time and Join action.
- [ ] Long preview titles pause with an ellipsis and scroll within their own bounds; Reduce Motion keeps them static.
- [ ] Fast date navigation cannot join a stale preview.
- [ ] ⌘O on selected dates opens the correct agenda and prefill event creation.
- [ ] Create form uses the selected account, validates time ranges and remembers its last writable calendar.
- [ ] Single-day and multi-day all-day events include exactly the selected dates.
- [ ] Saving disables the button; failure preserves input and allows retry.
- [ ] Refreshing the calendar picker preserves entered form fields.
- [ ] ⌘[ and the back button return to the main Alfred search; ⎋ closes; separate-window mode works.
- [ ] Rebuild, package and inspect with `unzip -l`; no preferences, snapshots or dependencies are included.

Automated tests exercise parsing and a fake EventKit store without modifying user calendars.
Real EventKit permission/read/write verification must be recorded separately from the fake tests.

## Development verification (November 24, 2026)

- Calendar permission confirmed; real EventKit reads returned 14 calendars.
- Live filter validation: 3 linked meetings, 4 timed events and 10 total entries in the current range.
- Quick Calendar, revised agenda and event form rendered and inspected in Alfred; committed screenshots use demo data only.
- CLI JSON checked from window directories under a bare environment; package contents inspected.
- Automated create/save tests use a fake EventKit store. No local-only calendar source was available,
  so no test events were written into the user's synced accounts. Real event creation, meeting-link
  opening and full keyboard/permission-denial interaction still need manual confirmation.

## Quick Calendar refinement

- A single bordered grid aligns headers, week numbers and dates; four-, five- and six-week months are covered by tests.
- Footer shortcut controls occupy an overlay, so both edges keep equal padding.
- Selected-day previews are hidden on empty days; title/time/action columns are bounded separately.
- Preview titles use a native label, ellipsis and native scrolling updates; no web view or fixed colour backing remains.
- Long-title scrolling stops with Reduce Motion, on empty previews and when a preview becomes stale.
- The Quick Calendar screenshot was refreshed using demo data only; live calendar data was restored afterwards.
