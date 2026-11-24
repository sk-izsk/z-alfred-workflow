# Contributing

Thanks for helping. Bug reports, fixes and small features are all welcome.

## Reporting a bug

1. Turn on **Debug** in the workflow's configuration and reproduce the problem.
2. Open `bw` → **Debug Log** and copy the lines around it. The log never contains passwords, but read it before posting anyway.
3. Open an issue with:
   - macOS, Alfred, Node.js and `bw --version` versions;
   - what you did, what you expected, and what happened;
   - the log lines.

**Never post** API keys, session keys, master passwords or vault contents. Report security problems privately via a [GitHub security advisory](https://github.com/sk-izsk/z-bitwarden/security/advisories/new) instead of a public issue.

## Development setup

You'll need macOS, Alfred 6 with the Powerpack, [Bun](https://bun.sh), Node.js 18+ and the Bitwarden CLI. Use a **test Bitwarden account**, not your real vault.

```bash
bun install
```

```bash
bun run build && bun run link
```

- `bun run link` symlinks `workflow/` into Alfred. After that, `bun run build` is all you need.
- Turn on **Debug** in the workflow's configuration while developing.

## Making a change

1. Branch from `dev`.
2. Edit the sources:
   - `src/` for the logic;
   - `ui/` for the Alfred UI windows;
   - `scripts/plist.ts` for keywords, wiring and settings.

   `workflow/*.alfredui/ui.json` and `workflow/info.plist` are **generated**, so don't edit them by hand.
3. Run the checks (CI runs the same):
   ```bash
   bun run check
   ```
4. Try it in Alfred and tick the relevant items in [TESTING.md](TESTING.md).
5. Open a pull request into `dev` that says what changed and how you tested it.

## Code style

- TypeScript, formatted with **oxfmt** (`bun run fmt`) and linted with **oxlint**.
- Small modules, arrow functions, and no new runtime dependencies (the workflow ships one bundled file).
- Non-trivial logic gets a small `bun test` in `tests/`.
- **Secrets never go in command-line arguments or logs.** Pass them through stdin or env (see `src/proc.ts`, `src/keychain.ts`).

## Alfred UI notes

These behaviours are easy to trip over:

- Sheets can't open during `preload`; open them from `launched`.
- `finish` is ignored while a sheet is open, so close the sheet first.
- A root shortcut `⌘↩` swallows every ⌘ key. Put `⌘↩` on a button's `shortcut` instead.
- Hidden views keep their space (overlay them in a `stack`), and labels don't grow after an `update`, so give them fixed widths.
- A `pulse` only starts when a script returns `{ "pulse": { "interval": 1 } }`.
- A fixed `window.size.width` stops the window opening inside Alfred. Resize with `{ "window": { "resize": { "width": … } } }` on `preload` instead.
- ⎋ closes the window inside Alfred before any script runs.

## Releasing

1. Bump `version` in `package.json`.
2. Tag `vX.Y.Z` and push the tag. CI builds `Bitwarden.alfredworkflow` and attaches it to a GitHub release.
