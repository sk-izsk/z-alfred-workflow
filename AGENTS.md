# Working in this repository

- Identify assumptions and biases; offer counterpoints when evidence warrants them.
- Each `workflows/<name>` is an independent Bun + TypeScript project. Run commands there.
- Follow nested workflow instructions. Preserve workflow identifiers, licenses and notices.
- Generate `ui.json` and `info.plist` from their TypeScript sources; do not hand-edit them.
- Run the affected workflow's `bun run check` and `bun run package` before proposing a merge.
- Keep secrets, local Alfred preferences, dependencies and compiled bundles out of Git.
- Use feature branches and PRs into `dev`; use namespaced tags as described in RELEASING.md.

- Every workflow must expose a configurable Back shortcut, default `Hyper+B` (`⌃⌥⇧⌘B`), and a visible Back action
  in every footer, including sheets. Never put Back inside the Actions / ⌘K menu. Back returns
  one UI level, restoring the previous screen and its state. Sheets close to their parent view.
  Only Back at the first screen uses finish → post to reopen Alfred's main search.

- Exception: a workflow whose results live in Alfred's own list (a Script Filter, like Menu Bar on
  `m`) has no window, so it has no Back footer; Escape and Alfred's own navigation apply. Prefer this
  when the user wants results as they type the keyword, with no window to open.

- Workflow command menus count as navigation levels: a list opened from a workflow menu returns
  to that menu, never directly to empty Alfred search.

- Follow [UI_CONVENTIONS.md](UI_CONVENTIONS.md): standard width 780, screen-aware clamping,
  configurable Hyper modifiers and compact footer labels. Apply to current/new workflows now;
  keep existing and future workflows consistent, preserving user choices.

- Use `shared/sheet.ts` for native sheets so Back, primary actions and Escape stay consistent.
- Any terminal handoff must use `shared/terminal.ts` and expose the shared terminal selector in Workflow Configuration; preserve existing user choices.

## Rules learned from the workflow review (2026-11)

These are mandatory for every workflow except where noted. Check a change against them before
proposing it.

### Secrets and API keys

- Keep every API key, token or secret in the macOS Keychain through `shared/keychain.ts`
  (service = the workflow's bundle ID, account = the key's name). Never in a Workflow Configuration
  field, `prefs.plist`, argv, logs, cache or state files, or `ui.json` defaults.
- A key is typed into a `passwordfield` in a sheet built with `shared/sheet.ts`, and reaches the script
  through the action's `variables` (`{value:field.text}`) declared with `scriptenv: true`. Writes use
  `security -i` on stdin (the helper does this), so the key never appears in `ps`.
- Offer **Set … API Key…** and **Remove … API Key** in Actions (⌘K), and point missing-key errors
  there. When moving an existing setting to the Keychain, call `keychain().migrate` so current users
  keep working and the plain-text copy is deleted.
- Bitwarden has its own split-key Keychain design. Do not change it to this helper.

### Web views (native first)

- Use a `webkitview` only for what native Alfred UI components cannot do, and record the reason in
  UI_CONVENTIONS.md's exception list. Current needs: interactive maps (Maps), swipe/scroll paging and
  drag and drop (Launchpad: Alfred UI has no scroll, swipe or drag events, only clicks and mouse
  down/up), drag sliders (Lunar) and drawn charts (Speed Test). Anything else is native.
- Verified in Alfred 6 (2026-11), so don't reach for a web view for these:
  - `imageview` plays animated GIFs and shows PNG, JPEG, WebP, SVG and PDF files.
  - `markdownarea` renders headings, lists, tables, code blocks, links and **local** images (PNG,
    JPEG, GIF, SVG) given as plain absolute paths. It does **not** load web images, `file://` URLs
    or paths containing spaces. So download remote images first, into a folder whose path has no
    spaces (Alfred's own cache, "…/Workflow Data/…", has one: use `os.tmpdir()`), and pass the
    plain path. It can't size an image or draw an image inside a link: put icons in a native
    `imageview` beside it, unwrap linked badges, and drop images that can't be fetched.
  - `markdownarea` paints its own background: set `background: null` and pad its container, or
    text touches the edge.
  - Its scroll bar can't be hidden (tried `scroller`, `showsverticalscroller`, `hasverticalscroller`,
    `scrollbars`: all ignored) and it has no scroll function, so a "scroll down" button can't work.
    The bar follows macOS: System Settings → Appearance → Show scroll bars.
- Images never load from URLs in native components: download to the cache, with a timeout, a size
  limit and a remembered failure list so a dead image doesn't slow every view.
- Before choosing a web view for anything new, test the native component in Alfred (a throwaway
  workflow with an External Trigger, captured with `screencapture -l`) and write the result here.

### macOS APIs without a compiled helper

- Reach system frameworks (CoreAudio, CoreGraphics, AppKit) from JXA through `/usr/bin/osascript`
  before shipping a binary: a bundled binary must be signed and notarised, and `swift`/`python3` need
  Xcode tools the user may not have. Sound (`workflows/z-sound/workflow/bin/audio.js`) is the
  reference.
- C functions taking struct pointers crash osascript (exit 139) when called through BridgeSupport
  (`ObjC.import("CoreAudio")`). Instead `ObjC.bindFunction` them with `void *` arguments, pass memory
  from a bound `malloc` filled and read through `NSData` (`getBytesLength`, `dataWithBytesLength`),
  and read object results (CFString) with an `id *` out argument and `Ref()`.
- A JXA crash or uncaught error prints nothing: wrap `run()` in try/catch and return JSON
  `{error}`, and test each step in its own `osascript` process.
- Never send keystrokes (System Events) to test a window while the user is working: a stray Return
  lands in their app. Use the CLI in a bare environment, and ask the user to check on screen.

### Speed

- Script actions without `async: true` block the window. Use them only for instant work (under
  ~50 ms) that must finish before the next event. Per-keystroke and per-selection actions are async.
  Async handlers that draw state must ignore replies that arrive out of order (`freshSelection` in
  `shared/dashboard.ts`, or a request ticket).
- Never run a slow command (about a second or more: `system_profiler`, `top -l 2`, network scans) on
  a timer. Timers do cheap checks; slow work runs on open, on ⌘R, or at most every minute.
- Show what is available first and add slow details after (Kill Process shows `ps` before `top`).
- Cache results that rarely change between launches (the shared display-width probe is cached).

### Shared code

- Use `shared/env.ts`, `shared/launcher.ts`, `shared/proc.ts`, `shared/keychain.ts`,
  `shared/dashboard.ts`, `shared/sheet.ts`, `shared/terminal.ts` and `shared/ui-profile.ts` instead of
  copying them. When a second workflow needs a helper, move it into `shared/`; Bun bundles it into
  each workflow, so installed workflows stay independent.

### Errors and tests

- No empty `catch {}`: state in a comment why ignoring the error is safe, or show the error.
- Anything that deletes, kills, stops, overwrites, connects or pays needs tests for its guards (wrong
  or changed target, outside the allowed scope, one bad item stopping a batch) with the real action
  replaced by a stub.
- Tests never touch real user data, real Keychain items, live services or system state.

### Documentation

- Each workflow README has: a title and one-line summary, a screenshot, requirements, how to open it,
  actions, safety/privacy notes where relevant, Configuration, Development, and Credits and AI
  disclosure.
- The Configuration table is generated: after changing `scripts/plist.ts`, run `bun run build` in the
  workflow, then `bun scripts/readme-config.ts` from the repository root. CI runs it with `--check`.
- Screenshots use made-up data only: no real names, device or network names, email addresses,
  accounts, or paths containing a username. Never commit an absolute path that contains a username.

### Versions and releases

- Raise `version` in `package.json` for every workflow a PR changes (patch for fixes, minor for new
  behaviour). After the merge, tag `z-<name>/vX.Y.Z` on the merged commit (see RELEASING.md) and
  update that workflow's link in the root README.
