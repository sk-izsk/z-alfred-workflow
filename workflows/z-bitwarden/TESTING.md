# Manual test checklist

Run these on a Mac with Alfred 6 + Powerpack, Node.js and the Bitwarden CLI. Use a **test Bitwarden account** first.

Legend: ✅ already verified on the dev Mac · 🔲 still needs a human (Touch ID, real master password, fresh install).

## 0. Install
- 🔲 Double-click `Bitwarden.alfredworkflow` → Import.
- 🔲 Open Configure Workflow: every option has a sensible default.
- 🔲 `bw` → Search Vault → login sheet. Paste client_id + client_secret → unlock sheet → master password → items load.
- 🔲 macOS asks to let Alfred control the browser (site suggestions) and for Accessibility (autofill). Allow both.

## 1. Unlock & security (needs Touch ID)
- 🔲 Quick Unlock = **Touch ID**: `bwlock`, then `bw` → Search Vault → Touch ID prompt → vault opens (the window reopens by itself).
- 🔲 Cancel the Touch ID prompt → the window comes back with the unlock sheet. It doesn't prompt again by itself; the **Touch ID** button retries.
- 🔲 Quick Unlock = **PIN**: unlock with the master password and type a PIN in "Set a PIN" → `bwlock` → unlock with the PIN. Five wrong PINs → the master password is required.
- 🔲 Lock After = 15 minutes: wait 15 min idle → the vault asks to unlock again.
- 🔲 Re-prompt item (GitHub): ↩ → master-password sheet → the correct password fills; a wrong one shows "Wrong master password". Its TOTP stays `••• •••` 🔒 everywhere.

## 2. Search window (`bw` → Search Vault, or `bw <text>`)
- ✅ `bw git` → "Search vault for 'git'" → opens filtered.
- ✅ Website icons, folder tags, favorite ★, lock 🔒, clock, live TOTP code + countdown ring.
- ✅ Vivaldi on facebook.com → the vault opens with `facebook` in the search field, showing only matching items. 🔲 Safari / Chrome / Arc, and Current Site = Pin / Off.
- ✅ ↩ Autofill: username ⇥ password into the field you had focused; TOTP then on the clipboard.
- ✅ "Press Return after filling" on: autofill submitted the Facebook form (window closed ~0.5 s after ↩, no `bw` call).
- 🔲 ⌘↩ paste password · ⌘C copy password · ⌘U username · ⌘T TOTP · ⌘O open site · ⌘Y details.
- 🔲 Clipboard history (Alfred / Raycast / Maccy) does **not** record copied passwords; the clipboard clears after the set time.
- 🔲 ⌘K actions menu: every item action works; Add TOTP Key, favorite toggle.
- ✅ ⌘[ (Back) → returns to the Bitwarden command menu. Change *Back Shortcut* in the configuration → the new shortcut and the footer hint both update.
- 🔲 ⌘P folder picker filters; ⌘R sync; ⌘L lock.
- 🔲 TOTP Codes = Footer / Hidden behave as described.

## 3. Other windows
- ✅ Authenticator (`bwotp`): live codes, rings, ↩ copy, ⌘↩ paste.
- ✅ Generator (`bwgen`): password is instant; passphrase works; settings are remembered; ↩ copy; ⌘↩ paste.
- ✅ Quick generator (`bwgq`): pastes into the front app.
- ✅ Sends (`bwsend`): ⌘N create (link copied), ⌘R receive, ⌘⌫ delete.
- ✅ New Login (`bwnew`): saves; 🔲 name/URL pre-filled from the current browser tab.
- ✅ `bwfolder Name`, `bwsync`.

## 4. Accounts
- ✅ `bw switch` → ↩ → account list → pick → Touch ID/password is asked **before** the window opens (no flash).
- ✅ Add Account… → login sheet for a second account.
- 🔲 `bwlogout` on a test account → removed from the list, falls back to another account.

## 5. Debugging
- 🔲 Debug on → reproduce the slow step → `bw` → Debug Log → send the lines around the slow step.
- 🔲 Lock After = 2 (minutes) → wait → the vault locks; the window still opens instantly (the lock no longer blocks it).

## 6. Settings
- 🔲 "Open in a separate window" → windows open as their own app windows.
- 🔲 Keywords changed → the new keywords work.
- 🔲 Self-hosted / EU server URL → login works.
