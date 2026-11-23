# Bitwarden for Alfred

Search, autofill and manage your [Bitwarden](https://bitwarden.com) vault from [Alfred 6](https://www.alfredapp.com). It uses native [Alfred UI](https://www.alfredapp.com/help/alfredui/) windows that follow your Alfred theme.

> Unofficial community workflow. Not affiliated with or endorsed by Bitwarden Inc.

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
| Quick Unlock | Off | Off, or opt in to Touch ID (or Mac password / Apple Watch) or PIN |
| Re-prompt Grace | 5 minutes | How long a confirmed master password counts for protected items |
| Sync | On open, if older than 5 min | Pull changes when opening |
| Icons | On | Website icons from Bitwarden's icon server |
| Server URL / Self-signed Certificate | — | Self-hosted or EU servers |
| Bitwarden CLI / Node.js path | auto | Only if they aren't found automatically |
| Debug | Off | Write a timing log (see Troubleshooting) |

## Security and privacy: what you are signing up for

This is a convenience layer on top of the official Bitwarden CLI. It is **not** the Bitwarden app, it is **not affiliated with Bitwarden**, and it has **not been independently audited**. It was reviewed with automated checks and manual testing, but read this section and pick the trade-off you are comfortable with.

### How your master password is handled

1. You type it into Alfred's unlock sheet.
2. The workflow hands it to the official `bw` CLI (`bw unlock`) through an environment variable of that one process. It never appears on a command line, so `ps` can't show it.
3. The CLI returns a temporary **session key**. The workflow keeps the session key in your login Keychain and drops the password. **With Quick Unlock off (the default), your master password is not saved anywhere.**
4. Every later action (search, autofill, copy) uses the session key until you lock or the idle timer runs out.
5. Two small leftovers while you are unlocked: a salted hash of your master password (used only for the *re-prompt* check on protected items, deleted when you lock), and the masked dots that stay in the unlock field after a wrong attempt until the window closes.

### Where things live

| What | Where | When it goes away |
|---|---|---|
| Master password | Not stored (Quick Unlock off) | Never written |
| Session key | Login Keychain (`com.izsk.bitwarden`) | Lock, or the first use after the idle timeout |
| Re-prompt hash of your master password | Workflow data folder | Lock |
| Full vault cache (`vault.enc`) | Disk, AES-256-GCM, key derived from the session | Lock |
| Names, usernames, URLs, flags | Disk, **not encrypted** | Logout (stays while locked) |
| Logins, TOTP seeds of an open window | Alfred's memory | The window closing or a lock |
| Copied secrets | Clipboard, marked concealed | Cleared after your chosen time, if you haven't copied something else |
| Debug log | Only if Debug is on | **Clear Debug Log**. It can contain error text from the `bw` CLI. |
| API key (`client_secret`) | The workflow's own `bw` data folder, **possibly in plain form** (upstream CLI behaviour; not verified here) | Logging out may not remove it. Revoke the key in the web vault if you stop using the workflow. |

### Choose your trade-off

| | Safest | Balanced (default) | Convenient |
|---|---|---|---|
| Quick Unlock | Off | Off | Touch ID or PIN (opt-in) |
| Lock After | 1-5 minutes | 15 minutes | 60 minutes or more |
| Passwords on the clipboard | Never (tick *Never put passwords on the clipboard*) | Yes, cleared after 1 minute | Yes, longer or never cleared |
| Website icons | Off | On | On |
| Debug | Off | Off | Off |
| Re-prompt Grace | Ask every time | 5 minutes | 5 minutes or more |
| **What you give up** | More typing. Passwords with non-ASCII characters are refused in clipboard-free mode. | Passwords touch the clipboard briefly. | A saved master password sits in the Keychain, and the vault stays open longer. |

**Quick Unlock is a convenience, not protection.** Touch ID or the PIN is checked by this workflow, not enforced by macOS. Your master password is stored in the login Keychain, so anything that can read your Keychain can skip the check. Leave it off if you want the strongest setup. **Lock After = 0 means never lock. Don't.**

**Website icons** are fetched from Bitwarden's icon server (`icons.bitwarden.net`). That tells the server which sites you have logins for. Turn *Icons* off if that matters to you.

### What it does *not* protect against

- **Malware or a hostile app running as your user while the vault is unlocked.** It can likely read the session key from your Keychain and read your vault. A short *Lock After* only shortens that window.
- **Anyone who can read your disk.** Item names, usernames and URLs are unencrypted. Turn on **FileVault** for the whole disk.
- **Memory.** Secrets exist in memory while a window is open or while the CLI works.
- **The clipboard.** Concealment is advisory, other apps can still read it, and the TOTP code is still copied after an autofill unless you turn that off.
- **The CLI itself.** Upstream behaviour such as `client_secret` storage and error text is outside this workflow's control.
- **Highest-value secrets.** For bank logins, recovery codes and crypto seeds, use the official Bitwarden app.

### Other protections that are in place

- Only the official `bw` CLI talks to Bitwarden. The workflow uses its own CLI data folder, so your terminal `bw` login is untouched.
- Secrets go through stdin or environment variables, never arguments. Password-protected file Sends are refused because the CLI would put the password in process arguments.
- Environment variables that hold secrets are not passed to unrelated helper processes.
- After a lock, an old window can't autofill, copy or show codes, and a refresh that straddles a lock is discarded.
- Re-prompt items never show their TOTP code or password until you confirm your master password.

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

- **Errors are always logged**, even with Debug off.
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
- **File Sends with a password** pass that password to `bw` as an argument; `bw send` offers no other way.

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

## License

[MIT](LICENSE). Keyword icons come from the MIT-licensed [Raycast Bitwarden extension](https://github.com/raycast/extensions/tree/main/extensions/bitwarden), whose feature set inspired this workflow. Bitwarden is a trademark of Bitwarden Inc.
