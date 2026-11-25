/**
 * info.plist as code: keywords → (launch mode) → Alfred UI → post step → notification.
 * `bun run build` turns this into workflow/info.plist (via plutil).
 */
import pkg from "../package.json" with { type: "json" };

type Obj = Record<string, unknown>;
const objects: Obj[] = [];
const connections: Record<string, Obj[]> = {};
const uidata: Record<string, Obj> = {};

const add = (uid: string, type: string, version: number, config: Obj, x: number, y: number): string => {
  objects.push({ uid, type: `alfred.workflow.${type}`, version, config });
  uidata[uid] = { xpos: x, ypos: y };
  return uid;
};
const link = (from: string, to: string) => {
  (connections[from] ??= []).push({
    destinationuid: to,
    modifiers: 0,
    modifiersubtext: "",
    vitoclose: false,
  });
};

const keyword = (
  uid: string,
  kw: string,
  title: string,
  subtext: string,
  x: number,
  y: number,
  arg: 0 | 1 | 2 = 2,
) =>
  add(
    uid,
    "input.keyword",
    1,
    {
      keyword: kw,
      text: title,
      subtext,
      argumenttype: arg, // 0 required, 1 optional, 2 none
      withspace: arg !== 2,
      skipuniversalaction: true,
    },
    x,
    y,
  );

const script = (uid: string, body: string, x: number, y: number) =>
  add(
    uid,
    "action.script",
    2,
    {
      script: body,
      scriptargtype: 1,
      type: 11, // /bin/zsh --no-rcs
      escaping: 0,
      scriptfile: "",
      concurrently: false,
    },
    x,
    y,
  );

const notification = (uid: string, x: number, y: number) =>
  add(
    uid,
    "output.notification",
    1,
    {
      title: "{const:alfred_workflow_name}",
      text: "{query}",
      onlyshowifquerypopulated: true,
      lastpathcomponent: false,
      removeextension: false,
    },
    x,
    y,
  );

/** Same trick as Alfred's own Mobile Web Tester: the user picks inside Alfred vs. separate window. */
const launchMode = (uid: string, x: number, y: number) =>
  add(
    uid,
    "utility.json",
    1,
    {
      json: JSON.stringify(
        {
          alfredworkflow: {
            arg: "{query}",
            config: { launchmode: "{var:launch_external}" },
          },
        },
        null,
        2,
      ),
    },
    x,
    y,
  );

const alfredui = (uid: string, path: string, x: number, y: number) =>
  add(uid, "userinterface.alfredui", 1, { path, stackview: true, launchmode: 0 }, x, y);

// ── shared post-close step ──
const post = script("POST", "./bin/bwa post", 760, 300);
const postNote = notification("POSTNOTE", 960, 300);
link(post, postNote);

// ── windows ──
const windows: [string, string, string, string, string][] = [
  // uid, keyword var, title, subtext, package
  [
    "SEARCH",
    "{var:kw_search}",
    "Search Vault",
    "Search, autofill and copy from your Bitwarden vault",
    "search.alfredui",
  ],
  [
    "GEN",
    "{var:kw_generate}",
    "Generate Password",
    "Generate a password or passphrase",
    "generator.alfredui",
  ],
  ["AUTH", "{var:kw_totp}", "Authenticator", "Live TOTP codes from your vault", "authenticator.alfredui"],
  ["SENDS", "{var:kw_sends}", "Sends", "Create, copy, delete and receive Bitwarden Sends", "sends.alfredui"],
  [
    "NEW",
    "{var:kw_new}",
    "New Login or Note",
    "Save a new login (with TOTP) or secure note",
    "newlogin.alfredui",
  ],
];
/** Windows with a list accept a query: `bw git` opens Search Vault already filtered. */
const TAKES_QUERY = new Set(["SEARCH", "AUTH", "SENDS"]);
windows.forEach(([uid, kw, title, sub, path], i) => {
  const y = 20 + i * 130;
  const j = launchMode(`${uid}JSON`, 640, y + 30);
  const u = alfredui(`${uid}UI`, path, 800, y);
  link(j, u);
  link(u, post);
  // Search Vault is reached through the `bw` menu; the others also keep their own keyword.
  if (uid !== "SEARCH") link(keyword(`${uid}KW`, kw, title, sub, 430, y, TAKES_QUERY.has(uid) ? 1 : 2), j);
  // External Trigger, so scripts (switch account → reopen) can open any window.
  link(
    add(
      `${uid}EXT`,
      "trigger.external",
      1,
      { triggerid: uid.toLowerCase(), availableviaurlhandler: false },
      430,
      y + 70,
    ),
    j,
  );
});

// ── the `bw` menu: Script Filter → route to a window, or run an action ──
const rootFilter = add(
  "ROOT",
  "input.scriptfilter",
  3,
  {
    keyword: "{var:kw_search}",
    title: "Bitwarden",
    subtext: "Search your vault, or pick a command",
    runningsubtext: "…",
    script: './bin/bwa root "$1"',
    scriptargtype: 1,
    type: 11,
    escaping: 102,
    scriptfile: "",
    withspace: true,
    argumenttype: 1,
    argumenttreatemptyqueryasnil: false,
    alfredfiltersresults: false,
    alfredfiltersresultsmatchmode: 0,
    queuemode: 1,
    queuedelaymode: 0,
    queuedelaycustom: 3,
    queuedelayimmediatelyinitially: true,
    skipuniversalaction: true,
  },
  30,
  300,
);
const ROUTES: [string, string][] = [
  ["search", "SEARCH"],
  ["auth", "AUTH"],
  ["gen", "GEN"],
  ["sends", "SENDS"],
  ["new", "NEW"],
];
const route = add(
  "ROUTE",
  "utility.conditional",
  1,
  {
    conditions: ROUTES.map(([target, uid]) => ({
      inputstring: "{var:bw_target}",
      matchmode: 0,
      matchstring: target,
      matchcasesensitive: false,
      outputlabel: target,
      uid: `ROUTE-${uid}`,
    })),
    elselabel: "action",
    hideelse: false,
  },
  250,
  300,
);
link(rootFilter, route);
for (const [, uid] of ROUTES) {
  (connections[route] ??= []).push({
    destinationuid: `${uid}JSON`,
    modifiers: 0,
    modifiersubtext: "",
    sourceoutputuid: `ROUTE-${uid}`,
    vitoclose: false,
  });
}
const rootAction = script("ROOTACT", "./bin/bwa root-action", 430, 720);
link(route, rootAction);
link(rootAction, notification("ROOTNOTE", 640, 720));

// Hotkey for search (unset by default; the user picks one).
const hotkey = add(
  "SEARCHHK",
  "trigger.hotkey",
  2,
  {
    hotkey: 0,
    hotmod: 0,
    hotstring: "",
    action: 0,
    argument: 0,
    relatedAppsMode: 0,
    focusedappvariable: false,
    focusedappvariablename: "",
    leftcursor: false,
    modsmode: 0,
  },
  30,
  700,
);
link(hotkey, "SEARCHJSON");

// ── keyword-only commands (no window) ──
const quick: [string, string, string, string, string, 0 | 1 | 2][] = [
  [
    "QUICK",
    "{var:kw_quickgen}",
    "Generate Password (Quick)",
    "Generate with your saved settings and paste",
    "./bin/bwa gen-quick",
    2,
  ],
  ["FOLDER", "bwfolder", "New Folder", "bwfolder <name>", './bin/bwa create-folder "$1"', 0],
  ["SYNC", "bwsync", "Sync Vault", "Pull the latest changes from Bitwarden", "./bin/bwa sync-vault", 2],
  ["LOCK", "bwlock", "Lock Vault", "Lock now (Touch ID / PIN can unlock again)", "./bin/bwa lock", 2],
  ["LOGOUT", "bwlogout", "Log Out", "Log out and forget the session and quick unlock", "./bin/bwa logout", 2],
];
quick.forEach(([uid, kw, title, sub, body, arg], i) => {
  const y = 820 + i * 110;
  const k = keyword(`${uid}KW`, kw, title, sub, 30, y, arg);
  const s = script(`${uid}RUN`, body, 400, y);
  const n = notification(`${uid}NOTE`, 600, y);
  link(k, s);
  link(s, n);
});

// ── Workflow Configuration ──
const text = (variable: string, label: string, def: string, description = "") => ({
  type: "textfield",
  variable,
  label,
  description,
  config: { default: def, placeholder: "", required: false, trim: true },
});
const check = (variable: string, label: string, textValue: string, def: boolean, description = "") => ({
  type: "checkbox",
  variable,
  label,
  description,
  config: { default: def, text: textValue, required: false },
});
const pick = (variable: string, label: string, pairs: [string, string][], def: string, description = "") => ({
  type: "popupbutton",
  variable,
  label,
  description,
  config: { default: def, pairs },
});
const file = (variable: string, label: string, description: string, mode = 0) => ({
  type: "filepicker",
  variable,
  label,
  description,
  config: { default: "", filtermode: mode, placeholder: "", required: false },
});

const userconfigurationconfig = [
  text("kw_search", "Keyword", "bw", "Opens the Bitwarden menu: search, authenticator, generator, accounts…"),
  text("kw_generate", "Generator Keyword", "bwgen"),
  text("kw_quickgen", "Quick Generator Keyword", "bwgq"),
  text("kw_totp", "Authenticator Keyword", "bwotp"),
  text("kw_sends", "Sends Keyword", "bwsend"),
  text("kw_new", "New Item Keyword", "bwnew"),
  check("launch_external", "Window", "Open in a separate window", false),
  text(
    "back_shortcut",
    "Back Shortcut",
    "⌘[",
    "Returns one screen; from the first screen, returns to the Bitwarden command menu. ⎋ can't do this: Alfred closes its windows on ⎋ itself.",
  ),
  pick(
    "enter_action",
    "Return Key",
    [
      ["Autofill username + password", "fill"],
      ["Paste password", "paste-password"],
      ["Copy password", "copy-password"],
    ],
    "fill",
    "What ↩ does on a login.",
  ),
  text(
    "actions_shortcut",
    "Actions Shortcut",
    "⌘K",
    "Shortcut for the actions menu. Use ⌘ ⌥ ⌃ ⇧ symbols, e.g. ⌘K or ⌘.",
  ),
  check("fill_submit", "Autofill", "Press Return after filling", false),
  check("copy_totp_after_fill", "", "Copy the TOTP code after autofill", true),
  pick(
    "site_match",
    "Current Site",
    [
      ["Filter: put the site name in the search field", "filter"],
      ["Pin matching items to the top", "pin"],
      ["Off", "off"],
    ],
    "filter",
    "Uses the front browser tab (Safari, Chrome, Arc, Brave, Edge…). Delete the text to see everything.",
  ),
  pick(
    "totp_display",
    "TOTP Codes",
    [
      ["In the footer, for the selected item", "footer"],
      ["On each row (timer in the footer)", "row"],
      ["Hidden", "off"],
    ],
    "footer",
  ),
  check("close_on_copy", "Copying", "Close the window after copying", true),
  check(
    "no_clipboard",
    "",
    "Never put passwords on the clipboard (autofill types them; Copy Password is off)",
    false,
  ),
  pick(
    "clipboard_clear",
    "Clear Clipboard",
    [
      ["After 15 seconds", "15"],
      ["After 30 seconds", "30"],
      ["After 1 minute", "60"],
      ["After 2 minutes", "120"],
      ["After 5 minutes", "300"],
      ["Never", "0"],
    ],
    "60",
  ),
  text("vault_timeout", "Lock After", "15", "Minutes of inactivity before the vault locks. 0 = never."),
  check("lock_on_sleep", "", "Also lock when the Mac sleeps or restarts", true),
  check("lock_on_screen_lock", "", "Also lock when the screen locks", true),
  check(
    "background_agent",
    "Background Agent",
    "Enforce the locks even while the workflow is closed (a small LaunchAgent, every 30 s)",
    true,
  ),
  check("background_sync", "", "Sync in the background while unlocked, so opening needs no sync", true),
  pick(
    "quick_unlock",
    "Quick Unlock",
    [
      ["Touch ID (or Mac password)", "touchid"],
      ["PIN", "pin"],
      ["Off (always master password)", "off"],
    ],
    "off",
    "Off keeps nothing saved. Touch ID / PIN are opt-in conveniences: they keep your master password in the macOS Keychain, behind a check in this workflow rather than a system-enforced lock.",
  ),
  pick(
    "reprompt_grace",
    "Re-prompt Grace",
    [
      ["Ask every time", "0"],
      ["1 minute", "1"],
      ["5 minutes", "5"],
      ["15 minutes", "15"],
    ],
    "5",
    "For items with master password re-prompt.",
  ),
  check("fetch_favicons", "Icons", "Show website icons (from Bitwarden's icon server)", true),
  check("sync_on_open", "Sync", "Sync when opening (if older than 5 minutes)", true),
  check("quick_paste", "Quick Generator", "Paste into the front app", true),
  text(
    "server_url",
    "Server URL",
    "",
    "Self-hosted or EU server, e.g. https://vault.bitwarden.eu. Blank = bitwarden.com.",
  ),
  file("server_cert_path", "Self-signed Certificate", "PEM file for a self-hosted server with a private CA."),
  check("debug", "Debug", "Write a debug log (timings of every step; never passwords)", false),
  file("bw_path", "Bitwarden CLI", "Only if `bw` isn't found automatically."),
  file("node_path", "Node.js", "Only if `node` isn't found automatically."),
];

const readme = `## Usage

Search your Bitwarden vault via the \`bw\` keyword. Press <kbd>↩</kbd> to autofill the page you came from (username, Tab, password), then the TOTP code is on your clipboard.

* <kbd>↩</kbd> Autofill (configurable).
* <kbd>⌘</kbd><kbd>↩</kbd> Paste password.
* <kbd>⌘</kbd><kbd>C</kbd> Copy password.
* <kbd>⌘</kbd><kbd>U</kbd> Copy username.
* <kbd>⌘</kbd><kbd>T</kbd> Copy TOTP.
* <kbd>⌘</kbd><kbd>O</kbd> Open website.
* <kbd>⌘</kbd><kbd>Y</kbd> Show details (cards, identities, notes, custom fields).
* <kbd>⌘</kbd><kbd>K</kbd> All actions.
* <kbd>⌘</kbd><kbd>P</kbd> Pick folder. <kbd>⌘</kbd><kbd>R</kbd> Sync. <kbd>⌘</kbd><kbd>L</kbd> Lock.

Generate passwords and passphrases via the \`bwgen\` keyword, or instantly with \`bwgq\`.

Show live TOTP codes via the \`bwotp\` keyword.

Create, copy and receive Sends via the \`bwsend\` keyword.

Save a new login or secure note via the \`bwnew\` keyword. Create a folder via the \`bwfolder\` keyword.

Lock, sync or log out via the \`bwlock\`, \`bwsync\` and \`bwlogout\` keywords.

Configure the Hotkey for faster access to the vault.

This workflow was built with the help of AI tools and has not been independently audited. Use it at your own risk; see the project page for how your passwords are handled.`;

export const infoPlist = {
  bundleid: "com.izsk.bitwarden",
  name: "Bitwarden",
  createdby: "izsk",
  description: "Search, autofill and manage your Bitwarden vault",
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-bitwarden",
  version: pkg.version,
  category: "Productivity",
  disabled: false,
  readme,
  objects,
  connections,
  uidata,
  userconfigurationconfig,
  variablesdontexport: [],
};
