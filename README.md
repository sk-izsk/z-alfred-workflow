# Bitwarden for Alfred

Search, autofill and manage your [Bitwarden](https://bitwarden.com) vault from [Alfred 6](https://www.alfredapp.com). It uses native [Alfred UI](https://www.alfredapp.com/help/alfredui/) windows that follow your Alfred theme.

> **Use at your own risk.** This is an unofficial community workflow, not affiliated with or endorsed by Bitwarden Inc. It handles your master password and vault data, has not been independently audited, and comes with no warranty. **The author is not responsible for any damage.** **This project was built with the help of AI tools (LLM coding assistants).** Read [how your passwords are handled](#use-at-your-own-risk-how-your-passwords-are-handled) before you install it.

## Features

- **Search your vault** with website icons, favorites, folders, and badges for TOTP, re-prompt and passkeys.
- **Opens on the right login:** on facebook.com the vault opens already filtered to `facebook`.
- **Autofill** (↩): types the username, Tab, then the password into the page you came from. Afterwards the TOTP code is waiting on your clipboard.
- **Copy or paste** the password, username, TOTP, notes or any field. Copied secrets are hidden from clipboard managers and cleared automatically.
- **Live TOTP codes** on each row, with a countdown ring.
- **Details** for cards, identities, notes, SSH keys and custom fields (⌘1–⌘9 copies a field).
- **Password / passphrase generator**, including a one-keystroke "generate and paste".
- **Authenticator** view, **Bitwarden Send** (create, copy link, receive, delete), **new login / secure note**, **new folder**.
- **Multiple accounts:** switch between them, each with its own unlock.
- **Optional Touch ID or PIN** (off by default) to unlock again after the vault locks, and the **master-password re-prompt** for protected items.
- **Self-hosted and EU servers**, including self-signed certificates.

## Use at your own risk: how your passwords are handled

> **Disclaimer.** This is an independent, community-built workflow. It handles your Bitwarden master password, session key and vault contents on your Mac. It is provided **"as is", without warranty of any kind**, and it has **not been independently audited**. **You use it entirely at your own risk. The author is not responsible or liable for any loss, damage, data exposure, locked-out accounts or other harm that results from using it**, as the [MIT license](LICENSE) also states. If you are not comfortable with that, use the official Bitwarden apps instead. This is a plain-language summary, not legal advice.

### The short version

- Your **master password is not saved** by default. You type it, it unlocks the vault once, and it is discarded.
- After unlocking, a temporary **session key** stays in your login Keychain until you lock, the idle timer runs out, or the Mac sleeps or restarts.
- While the vault is unlocked, **software running as you may be able to read it**. No launcher can fully prevent that, so keep the timeouts short.
- Every convenience (Touch ID or PIN, long timeouts, copying to the clipboard) trades some protection for speed. The [table below](#choose-your-trade-off) shows the safest setup and what it costs you.
- Try it with a **test account** first.

### How your master password is handled

1. You type it into Alfred's unlock sheet.
2. The workflow hands it to the official `bw` CLI (`bw unlock`) through an environment variable of that one process. It never appears on a command line, so `ps` can't show it.
3. The CLI returns a temporary **session key**. The workflow keeps the session key in your login Keychain and drops the password. **With Quick Unlock off (the default), your master password is not saved anywhere.**
4. Every later action (search, autofill, copy) uses the session key until the vault locks.
5. Two small leftovers while you are unlocked: a salted hash of your master password (used only for the *re-prompt* check on protected items, deleted when you lock), and the masked dots that stay in the unlock field after a wrong attempt until the window closes.

### Our approach

- **Let the official CLI do the cryptography, and store as little as possible.** No master password at rest by default, and the full vault cache is deleted on lock.
- **Be explicit, not implicit.** Helper processes receive an allow-list of environment variables, not a copy of everything. Secrets travel through stdin or environment variables, never arguments.
- **Fail closed.** If the Keychain refuses to delete the session, the vault still counts as locked. If the cache key is unavailable there is no cache, never a plain-text one. A modified cache is ignored. A window opened before a lock can't autofill, copy or show codes afterwards.
- **Short sessions.** The vault locks after your idle time, and also when the Mac sleeps or restarts.
- **Say what is not covered.** See [what it does not protect against](#what-it-does-not-protect-against).

Several of these choices follow the [Raycast Bitwarden extension](https://github.com/raycast/extensions/tree/main/extensions/bitwarden) (an explicit child environment, locking on sleep, encrypted cached metadata, quiet error logs). Others differ: this workflow keeps the session in the macOS Keychain, sends create and Send payloads on stdin instead of arguments, and hashes the re-prompt check with scrypt and a random salt per hash (Raycast uses PBKDF2 with a fixed salt).

### Where things live

| What | Where | When it goes away |
|---|---|---|
| Master password | Not stored (Quick Unlock off) | Never written |
| Session key | Login Keychain (`com.izsk.bitwarden`) | Lock, idle timeout, Mac sleep or restart |
| Re-prompt hash of your master password | Workflow data folder (scrypt, 128 MiB cost, random salt per hash) | Lock |
| Full vault cache (`vault.enc`) | Disk, AES-256-GCM, key derived from the session | Lock |
| Item names, usernames, URLs, flags | Disk, AES-256-GCM, with a random key kept in your login Keychain | Logout removes the file and the key. It stays while locked so the list can open instantly. |
| Logins and TOTP seeds of an open window | Alfred's memory | The window closing or a lock |
| Copied secrets | Clipboard, marked concealed | Cleared after your chosen time, if you haven't copied something else |
| Debug log | With Debug off: command name and error type only. With Debug on: messages, with tokens and emails masked. | **Clear Debug Log** |
| API key (`client_secret`) | The workflow's own `bw` data folder, **possibly in plain form** (upstream CLI behaviour; not verified here) | Logging out may not remove it. Revoke the key in the web vault if you stop using the workflow. |

### Choose your trade-off

| | Safest | Balanced (default) | Convenient |
|---|---|---|---|
| Quick Unlock | Off | Off | Touch ID or PIN (opt-in) |
| Lock After | 1-5 minutes | 15 minutes | 60 minutes or more |
| Lock when the Mac sleeps | On | On | Off |
| Passwords on the clipboard | Never (tick *Never put passwords on the clipboard*) | Yes, cleared after 1 minute | Yes, longer or never cleared |
| Website icons | Off | On | On |
| Debug | Off | Off | Off |
| Re-prompt Grace | Ask every time | 5 minutes | 5 minutes or more |
| **What you give up** | More typing. Passwords with non-ASCII characters are refused in clipboard-free mode. | Passwords touch the clipboard briefly. | A saved master password sits in the Keychain, and the vault stays open longer. |

**Quick Unlock is a convenience, not protection.** Touch ID or the PIN is checked by this workflow, not enforced by macOS. Your master password is stored in the login Keychain, so anything that can read your Keychain can skip the check. Leave it off if you want the strongest setup. **Lock After = 0 means never lock. Don't.**

**Website icons** are fetched from Bitwarden's icon server (`icons.bitwarden.net`). That tells the server which sites you have logins for. Turn *Icons* off if that matters to you.

### What it does *not* protect against

- **Malware or a hostile app running as your user while the vault is unlocked.** It can likely read the session key from your Keychain and read your vault. A short *Lock After* only shortens that window.
- **Anything that can read your login Keychain.** That includes the session key, the cache key and, if you opt in to Quick Unlock, the saved master password.
- **Memory.** Secrets exist in memory while a window is open or while the CLI works.
- **The clipboard.** Concealment is advisory, other apps can still read it, and the TOTP code is still copied after an autofill unless you turn that off.
- **The CLI itself.** Upstream behaviour such as `client_secret` storage is outside this workflow's control.
- **Highest-value secrets.** For bank logins, recovery codes and crypto seeds, use the official Bitwarden app. Turn on **FileVault** for the whole disk.

### Other protections that are in place

- Only the official `bw` CLI talks to your Bitwarden server. The one other connection is the optional website-icon fetch to `icons.bitwarden.net` (turn *Icons* off to stop it). The workflow uses its own CLI data folder, so your terminal `bw` login is untouched.
- Create, edit and Send payloads go to `bw` on stdin. Password-protected file Sends are refused because the CLI would put the password in process arguments.
- After a lock, a refresh that was already in flight is discarded instead of being saved.
- Re-prompt items never show their TOTP code or password until you confirm your master password.

## Requirements

| What | How |
|---|---|
| Alfred 6 + [Powerpack](https://www.alfredapp.com/powerpack/) | Alfred UI windows need Alfred 6 |
| [Bitwarden CLI](https://bitwarden.com/help/cli/) (`bw`) | `npm install -g @bitwarden/cli` (recommended) or `brew install bitwarden-cli` |
| [Node.js](https://nodejs.org) 18 or newer | Already there if you installed `bw` with npm |
| Your Bitwarden **personal API key** | Web vault → **Settings → Security → Keys → View API key** |

## Install

1. Download `Bitwarden.alfredworkflow` from the [latest release](https://github.com/sk-izsk/z-bitwarden/releases) and double-click it to import into Alfred.
2. Type **`bw`** in Alfred and choose **Search Vault**.
3. The **Log in** sheet opens:
   - **Server URL:** leave blank for bitwarden.com. EU accounts use `https://vault.bitwarden.eu`; self-hosted users enter their own URL.
   - **client_id** and **client_secret:** paste from *View API key*.
   - Click **Log In**.
4. Unlock with your **master password**. Your items appear.
5. When macOS asks, allow Alfred to:
   - use **Accessibility**, needed for autofill and paste;
   - **control your browser**, needed to open on the current site.

### Adding another account

`bw` → **Switch Account…** → **Add Account…**, then repeat steps 3–4 with that account's API key. Switch any time with `bw` → **Switch Account…**. Each account has its own login, unlock and cache.

## Everyday use

Type **`bw`** for the menu, or **`bw something`** to search the vault for it straight away.

| In the `bw` menu | Direct keyword |
|---|---|
| Search Vault | `bw <text>` |
| Authenticator | `bwotp` |
| Generate Password / Quick (generate + paste) | `bwgen` / `bwgq` |
| Sends | `bwsend` |
| New Login or Note | `bwnew` |
| New Folder | `bwfolder <name>` |
| Sync · Lock · Log Out | `bwsync` · `bwlock` · `bwlogout` |
| Switch Account… · Debug Log | |

### Shortcuts in the vault window

| Keys | Action |
|---|---|
| <kbd>↩</kbd> | Autofill (configurable: paste or copy instead) |
| <kbd>⌘</kbd><kbd>↩</kbd> | Paste password |
| <kbd>⌘</kbd><kbd>C</kbd> · <kbd>⌘</kbd><kbd>U</kbd> · <kbd>⌘</kbd><kbd>T</kbd> | Copy password · username · TOTP |
| <kbd>⌘</kbd><kbd>O</kbd> | Open the website |
| <kbd>⌘</kbd><kbd>Y</kbd> | Details |
| <kbd>⌘</kbd><kbd>K</kbd> | All actions for the item (configurable) |
| <kbd>⌘</kbd><kbd>P</kbd> · <kbd>⌘</kbd><kbd>R</kbd> · <kbd>⌘</kbd><kbd>L</kbd> | Folder picker · Sync · Lock |
| <kbd>⌘</kbd><kbd>[</kbd> | Back to the `bw` menu (configurable) |
| <kbd>⎋</kbd> | Close a popup, or close the window |

Every window's footer shows its main shortcuts.

**Why ⎋ doesn't go back:** Alfred closes its UI windows on ⎋ itself, before a workflow can react. So "back" has its own shortcut, ⌘[ by default.

## Settings

Alfred Preferences → Workflows → **Bitwarden** → **Configure Workflow**.

| Setting | Default | What it does |
|---|---|---|
| Keywords | `bw`, `bwgen`, `bwgq`, `bwotp`, `bwsend`, `bwnew` | Change any keyword |
| Window | Inside Alfred | Or open as a separate window |
| Back Shortcut / Actions Shortcut | ⌘[ / ⌘K | Use ⌘ ⌥ ⌃ ⇧ symbols |
| Return Key | Autofill | Or paste / copy the password |
| Autofill | — | Press Return after filling (submits the form); copy the TOTP after filling (on) |
| Current Site | Filter | Pre-fill the site name, pin matches to the top, or off |
| TOTP Codes | On each row | Or in the footer, or hidden |
| Copying | Close after copy | Keep the window open instead |
| Passwords on the clipboard | Allowed | Tick *Never put passwords on the clipboard* to type them instead (plain ASCII only). A TOTP is still copied after an autofill. |
| Clear Clipboard | 1 minute | 15 s … 5 min, or never |
| Lock After | 15 | Minutes idle before locking (0 = never) |
| Lock on sleep | On | The checkbox under Lock After, "Also lock when the Mac sleeps or restarts". The next use after a sleep or restart asks you to unlock again: for the master password, or, if you enabled Quick Unlock, for Touch ID or your PIN (which is weaker than the master password) |
| Quick Unlock | Off | Off, or opt in to Touch ID (or Mac password / Apple Watch) or PIN |
| Re-prompt Grace | 5 minutes | How long a confirmed master password counts for protected items |
| Sync | On open, if older than 5 min | Pull changes when opening |
| Icons | On | Website icons from Bitwarden's icon server |
| Server URL / Self-signed Certificate | — | Self-hosted or EU servers |
| Bitwarden CLI / Node.js path | auto | Only if they aren't found automatically |
| Debug | Off | Write step timings and full error messages to a log (see Troubleshooting). With it off, errors are noted by command name and type only. |

## Troubleshooting

### It feels slow

The Bitwarden CLI itself can take **~3 seconds per call** on some Macs, which is why the workflow caches an encrypted copy of the vault. If it's still slow:

1. Turn on **Debug** (see below) and look at the `bw …` lines.
2. Time the CLI in Terminal. Run `which bw` to see which install Alfred uses, then:
   ```bash
   time bw --version
   ```
   - Over about 1 second? Try the npm build: `npm install -g @bitwarden/cli`. Then set **Bitwarden CLI** in the configuration to its path (`npm prefix -g` + `/bin/bw`).
   - Use one install only, so Alfred and your shell use the same `bw`.
3. Low Power Mode and security/antivirus tools that scan every new process can also slow down each `bw` call.

### Debug log

Turn on **Debug** in the configuration, reproduce the problem, then `bw` → **Debug Log** (it opens in Console). Every step is listed with its duration:

```
▶ search-refresh
bw list items 859ms
osascript 191ms          ← browser tab lookup
✓ search-refresh 1114ms
```

- **Errors are always noted** by command name and error type. The message and stack are added only with Debug on, with tokens and email addresses masked.
- Secrets are not logged on purpose, but error messages from the `bw` CLI are logged as received and could contain sensitive text. Check the log before sharing it.
- File: `~/Library/Application Support/Alfred/Workflow Data/com.izsk.bitwarden/debug.log`. `bw` → **Clear Debug Log** empties it.

### Common problems

| Symptom | Fix |
|---|---|
| "Node.js not found" | Set **Node.js** in the configuration (`which node`) |
| Autofill does nothing | System Settings → Privacy & Security → **Accessibility** → enable Alfred |
| Doesn't open on the current site | System Settings → Privacy & Security → **Automation** → Alfred → enable your browser. Firefox can't share its tab URL. |
| "client_id or client_secret is incorrect" | Copy the API key again. EU / self-hosted accounts need the Server URL. |

## Limitations

- **Passkeys:** browsers send passkey requests only to registered credential providers (the Bitwarden extension or app). Neither Alfred nor the `bw` CLI can sign passkey logins. Items with a passkey get a badge, so you know to use the browser.
- **Fonts:** Alfred UI has no font-family option, so windows use the system font rather than a custom Alfred theme font. Colours and selection follow your theme.
- **Login:** uses the personal API key. Organisations that only allow SSO or "trusted devices" can't use the Bitwarden CLI.
- **File Sends with a password** can't be created here: `bw send` would put the password in the process arguments, so the workflow refuses and asks you to use Bitwarden. Text Sends with a password work.

## Development

You'll need macOS, Alfred 6, [Bun](https://bun.sh), Node.js and the `bw` CLI.

```bash
git clone https://github.com/sk-izsk/z-bitwarden.git
```

```bash
cd z-bitwarden && bun install
```

```bash
bun run build && bun run link
```

`bun run link` symlinks `workflow/` into your Alfred preferences, so changes show up after each `bun run build`.

| Command | What it does |
|---|---|
| `bun run build` | Bundles `src/` → `workflow/bin/bwa.mjs`, and generates every `*.alfredui/ui.json` and `info.plist` |
| `bun run check` | Typecheck + oxlint + oxfmt check + tests (what CI runs) |
| `bun run fmt` | Format with oxfmt |
| `bun run package` | Builds `dist/Bitwarden.alfredworkflow` |

### Project layout

```
src/                 TypeScript, bundled into workflow/bin/bwa.mjs
  main.ts            command router (UI windows → JSON actions; Run Scripts → text)
  commands/          one file per feature: search, item, account, post (autofill), generator, …
  bw.ts session.ts   Bitwarden CLI wrapper, lock/unlock/accounts
  vault.ts           items, rows, encrypted cache
  keychain.ts clipboard.ts touchid.ts keys.ts browser.ts log.ts
ui/                  Alfred UI windows as TypeScript → workflow/*.alfredui/ui.json
scripts/plist.ts     keywords, wiring and settings → workflow/info.plist
workflow/            the Alfred workflow folder (generated files + bin/bwa shim)
tests/               bun tests
assets/icons/        keyword icons
```

How it works:
- Each Alfred UI window calls `workflow/bin/bwa <command>` and applies the JSON it prints.
- After a window closes, `bwa post` does the autofill or paste, so your original app is in front again.
- **Edit `ui/` and `scripts/plist.ts`, not the generated `ui.json` / `info.plist`.**

See [CONTRIBUTING.md](CONTRIBUTING.md) and the manual checklist in [TESTING.md](TESTING.md).

## Credits

This workflow was **inspired by the [Bitwarden Vault extension for Raycast](https://github.com/raycast/extensions/tree/main/extensions/bitwarden)**, created by **jomifepe** and maintained by many contributors (see the `contributors` list in its [`package.json`](https://github.com/raycast/extensions/blob/main/extensions/bitwarden/package.json)). Its feature set and its approach to unlock, re-prompt and Sends shaped this project, and its source was a useful reference while building it. Thank you.

The keyword icons in `assets/icons/` come from that extension and are used under its MIT license. The required copyright and permission notice is in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

### AI assistance

This workflow was created with the help of AI tools (LLM coding assistants). They were used to write and refactor much of the code, the tests and this documentation, and to review the changes, alongside automated tests. It has **not** had an independent human security audit, so treat the security notes above accordingly.

This project is an independent Alfred implementation. It is not affiliated with or endorsed by Raycast, the extension's authors, or Bitwarden.

## License

[MIT](LICENSE). Third-party assets are covered by [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Bitwarden is a trademark of Bitwarden Inc.
