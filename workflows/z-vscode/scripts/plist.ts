/**
 * info.plist as code: keywords → (launch mode) → Alfred UI → post step.
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
/** `modifiers`: 0 = ↩, CMD = ⌘↩ (a Script Filter item's `mods.cmd` needs its own connection). */
const CMD = 1048576;
const OPT = 524288;
const link = (from: string, to: string, sourceoutputuid?: string, modifiers = 0, modifiersubtext = "") => {
  (connections[from] ??= []).push({
    destinationuid: to,
    modifiers,
    modifiersubtext,
    vitoclose: false,
    ...(sourceoutputuid && { sourceoutputuid }),
  });
};

/** argumenttype: 0 required, 1 optional, 2 none. */
const keyword = (
  uid: string,
  kw: string,
  title: string,
  subtext: string,
  x: number,
  y: number,
  arg: 0 | 1 | 2,
) =>
  add(
    uid,
    "input.keyword",
    1,
    {
      keyword: kw,
      text: title,
      subtext,
      argumenttype: arg,
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
    { script: body, scriptargtype: 1, type: 11, escaping: 0, scriptfile: "", concurrently: false },
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

/** Lets the user pick "inside Alfred" vs. "separate window" (like Alfred's own Mobile Web Tester). */
const launchMode = (uid: string, x: number, y: number) =>
  add(
    uid,
    "utility.json",
    1,
    {
      json: JSON.stringify(
        { alfredworkflow: { arg: "{query}", config: { launchmode: "{var:launch_external}" } } },
        null,
        2,
      ),
    },
    x,
    y,
  );

const alfredui = (uid: string, path: string, x: number, y: number) =>
  add(uid, "userinterface.alfredui", 1, { path, stackview: true, launchmode: 0 }, x, y);

// ── shared steps ──
const post = script("POST", "./bin/vsc post", 1100, 300);
const openScript = script("OPEN", './bin/vsc open "$1"', 540, 1000);
link(openScript, notification("OPENNOTE", 760, 1000));

// ── windows: [uid, keyword variable, title, subtext, package, argument type] ──
const windows: [string, string, string, string, string, 0 | 1][] = [
  [
    "PROJECTS",
    "{var:kw_projects}",
    "Search Recent Projects",
    "Search and open recent projects",
    "projects.alfredui",
    1,
  ],
  [
    "EXTENSIONS",
    "{var:kw_extensions}",
    "Show Installed Extensions",
    "Manage installed extensions",
    "extensions.alfredui",
    1,
  ],
  [
    "INSTALL",
    "{var:kw_install}",
    "Install Extension",
    "Install extensions from the Marketplace",
    "install.alfredui",
    1,
  ],
  ["THEMES", "{var:kw_themes}", "Change Theme", "Pick a color theme for a profile", "themes.alfredui", 1],
  // `codec` is a Script Filter (below), so the clone window has no keyword of its own.
  ["CLONE", "", "Clone Repository", "", "clone.alfredui", 0],
];
windows.forEach(([uid, kw, title, sub, path, arg], i) => {
  const y = 20 + i * 140;
  const j = launchMode(`${uid}JSON`, 760, y + 30);
  const u = alfredui(`${uid}UI`, path, 920, y);
  link(j, u);
  link(u, post);
  if (kw) link(keyword(`${uid}KW`, kw, title, sub, 540, y, arg), j);
});

const scriptFilter = (
  uid: string,
  kw: string,
  title: string,
  subtext: string,
  body: string,
  x: number,
  y: number,
) =>
  add(
    uid,
    "input.scriptfilter",
    3,
    {
      keyword: kw,
      title,
      subtext,
      runningsubtext: "…",
      script: body,
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
    x,
    y,
  );

// ── the `code` menu: Script Filter → route to a window, or run an action ──
const rootFilter = scriptFilter(
  "ROOT",
  "{var:kw_main}",
  "VS Code",
  "Recent projects, extensions, themes, clone a repo…",
  './bin/vsc root "$1"',
  30,
  300,
);
const ROUTES = ["projects", "extensions", "install", "clone", "themes"];
const route = add(
  "ROUTE",
  "utility.conditional",
  1,
  {
    conditions: ROUTES.map((target) => ({
      inputstring: "{var:vsc_target}",
      matchmode: 0,
      matchstring: target,
      matchcasesensitive: false,
      outputlabel: target,
      uid: `ROUTE-${target}`,
    })),
    elselabel: "action",
    hideelse: false,
  },
  300,
  300,
);
link(rootFilter, route);
link(rootFilter, route, undefined, CMD);

// ── `codec [folder] [url]`: folder suggestions + clone; ↩ opens the clone window, ⌘↩ clones now ──
const cloneFilter = scriptFilter(
  "CLONEFILTER",
  "{var:kw_clone}",
  "Clone Repository",
  "Type a folder, paste a git URL (or copy one first)",
  './bin/vsc clone-filter "$1"',
  30,
  480,
);
link(cloneFilter, route);
link(cloneFilter, route, undefined, CMD);
for (const target of ROUTES) link(route, `${target.toUpperCase()}JSON`, `ROUTE-${target}`);
const rootAction = script("ROOTACT", './bin/vsc root-action "$1"', 540, 700);
link(route, rootAction);
link(rootAction, notification("ROOTNOTE", 760, 700));

// ── Hotkey for Search Recent Projects (unset by default; the user picks one) ──
link(
  add(
    "PROJECTSHK",
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
    300,
    40,
  ),
  "PROJECTSJSON",
);

// ── Find files and folders with Spotlight (Alfred's File Filter) → open in the editor ──
link(
  add(
    "FIND",
    "input.filefilter",
    2,
    {
      argumenttrimmode: 0,
      keyword: "{var:kw_find}",
      daterange: 0,
      scopes: [],
      sortmode: 0,
      fields: ["kMDItemDisplayName", "kMDItemAlternateNames", "kMDItemFinderComment"].map((field) => ({
        split: true,
        value: "{query}",
        words: true,
        not: false,
        field,
      })),
      argumenttype: 0,
      anchorfields: true,
      title: "Find Files and Folders",
      runningsubtext: "",
      limit: 0,
      subtext: "Find anything on your Mac and open it in your editor",
      includesystem: false,
      types: [],
      withspace: true,
    },
    300,
    960,
  ),
  openScript,
);

// ── File Action: "Open in Code Editor" in Alfred's file actions (→ on any file or folder) ──
link(
  add(
    "FILEACTION",
    "trigger.action",
    1,
    { filetypes: [], acceptsmulti: 1, name: "Open in Code Editor" },
    300,
    1100,
  ),
  openScript,
);

// ── `codef` modifiers: ⌘↩ opens the folder in your terminal, ⌥↩ reveals it in Finder ──
const fileScript = (uid: string, action: string, y: number) => {
  const sc = script(uid, `./bin/vsc file-action ${action} "$1"`, 540, y);
  link(sc, notification(`${uid}NOTE`, 760, y));
  return sc;
};
link("FIND", fileScript("FINDTERM", "terminal", 1360), undefined, CMD, "Open in your terminal app");
link("FIND", fileScript("FINDREVEAL", "reveal", 1460), undefined, OPT, "Reveal in Finder");

// ── Universal Actions: → on any file or folder in Alfred (codef results, Finder selection, search) ──
const universal: [string, string, string][] = [
  ["UACLOSE", "Code Editor: Open and Close Other Windows", "close-others"],
  ["UAEDITOR", "Code Editor: Open in Another Editor…", "pick-editor"],
  ["UAPROFILE", "Code Editor: Open with Profile…", "pick-profile"],
  ["UATERM", "Code Editor: Open in Terminal", "terminal"],
  ["UAGITHUB", "Code Editor: Open on GitHub", "github"],
];
universal.forEach(([uid, name, action], i) => {
  const y = 1560 + i * 100;
  const trigger = add(
    uid,
    "trigger.universalaction",
    1,
    { acceptsfiles: true, acceptsmulti: 0, acceptstext: false, acceptsurls: false, name },
    300,
    y,
  );
  link(trigger, fileScript(`${uid}RUN`, action, y));
});

// ── New Window: keyword only, no window ──
const newKw = keyword(
  "NEWWINKW",
  "{var:kw_new}",
  "Open New Window",
  "Open a new editor window",
  300,
  1240,
  2,
);
const newRun = script("NEWWINRUN", "vsc_action=new-window ./bin/vsc root-action", 540, 1240);
link(newKw, newRun);
link(newRun, notification("NEWWINNOTE", 760, 1240));

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
const file = (variable: string, label: string, description: string, mode = 0, def = "") => ({
  type: "filepicker",
  variable,
  label,
  description,
  config: { default: def, filtermode: mode, placeholder: "", required: false },
});

// Same ids as src/editors.ts (tests/editors.test.ts keeps the two lists in sync).
export const EDITOR_CHOICES: [string, string][] = [
  ["Visual Studio Code", "Code"],
  ["Visual Studio Code - Insiders", "Code - Insiders"],
  ["Cursor", "Cursor"],
  ["Windsurf", "Windsurf"],
  ["Zed", "Zed"],
  ["Zed Preview", "Zed Preview"],
  ["VSCodium", "VSCodium"],
  ["VSCodium - Insiders", "VSCodium - Insiders"],
  ["Antigravity IDE", "Antigravity IDE"],
  ["Kiro", "Kiro"],
  ["Positron", "Positron"],
  ["Trae", "Trae"],
  ["Trae CN", "Trae CN"],
  ["Qoder", "Qoder"],
  ["Devin", "Devin"],
  ["Lingma", "Lingma"],
  ["IBM Bob", "IBM Bob"],
];

const userconfigurationconfig = [
  pick(
    "editor",
    "Editor",
    EDITOR_CHOICES,
    "Code",
    "Opens projects in this editor and reads its recent projects.",
  ),
  text("kw_main", "Keyword", "code", "Opens the menu: recent projects, extensions, clone, find…"),
  text("kw_projects", "Recent Projects Keyword", "codep"),
  text("kw_extensions", "Extensions Keyword", "codee"),
  text("kw_install", "Install Keyword", "codei"),
  text("kw_clone", "Clone Keyword", "codec"),
  text("kw_find", "Find Keyword", "codef", "Spotlight search for files and folders, opened in your editor."),
  text("kw_themes", "Theme Keyword", "codet"),
  text("kw_new", "New Window Keyword", "coden"),
  file(
    "clone_dir",
    "Clone Into",
    "Default folder for cloned repositories (you can change it each time).",
    1,
    "~/Developer",
  ),
  check("clone_clipboard", "", "Use a git URL from the clipboard", true),
  text(
    "scan_dirs",
    "Project Folders",
    "",
    "Comma separated folders to scan for git repos you haven't opened yet, e.g. ~/Developer, /Volumes/Work/Projects",
  ),
  check(
    "theme_auto_try",
    "",
    "Install Extension: try uninstalled themes automatically while browsing (otherwise ⌘T)",
    false,
  ),
  text(
    "profile",
    "VS Code Profile",
    "",
    "Profile used by Change Theme and the extension windows, e.g. React. Blank = the profile of your most recently opened project.",
  ),
  check(
    "theme_preview",
    "Themes",
    "Live preview in VS Code while moving through the list (⎋ restores)",
    true,
  ),
  check("launch_external", "Window", "Open in a separate window", false),
  check("close_others", "Opening", "Close other editor windows (⇧⌘↩ does the opposite)", false),
  check("show_branch", "Git", "Show the current git branch", true),
  text(
    "terminal_app",
    "Terminal App",
    "Terminal",
    "App for “Open with Terminal”, e.g. Terminal, iTerm, Ghostty, Warp.",
  ),
  text("actions_shortcut", "Actions Shortcut", "⌘K", "Use ⌘ ⌥ ⌃ ⇧ symbols, e.g. ⌘K or ⌘."),
  text(
    "back_shortcut",
    "Back Shortcut",
    "⌘[",
    "Closes a window and returns to the menu. ⎋ can't do this: Alfred closes its windows on ⎋ itself.",
  ),
  file("node_path", "Node.js", "Only if `node` isn't found automatically."),
];

const readme = `## Usage

Type \`code\` to open the menu, then pick a command, or keep typing:

* \`code\` + a name searches your recent projects.
* \`code install prettier\` searches the Marketplace.
* \`code https://github.com/owner/repo\` clones a repository (you choose where), then opens it.
* \`code ~/some/path\` opens that path.

In a list: <kbd>↩</kbd> opens, <kbd>⌘</kbd><kbd>K</kbd> shows every action, <kbd>⌘</kbd><kbd>[</kbd> goes back to the menu.

Recent projects: <kbd>⇧</kbd><kbd>⌘</kbd><kbd>↩</kbd> open and close other windows · <kbd>⇧</kbd><kbd>⌘</kbd><kbd>F</kbd> show in Finder · <kbd>⇧</kbd><kbd>⌘</kbd><kbd>T</kbd> open in Terminal · <kbd>⌘</kbd><kbd>O</kbd> open with… · <kbd>⇧</kbd><kbd>⌘</kbd><kbd>C</kbd> copy name · <kbd>⇧</kbd><kbd>⌘</kbd><kbd>P</kbd> pin · <kbd>⌘</kbd><kbd>P</kbd> filter by type.

Shortcuts: \`codep\` projects, \`codee\` installed extensions, \`codei\` install, \`codec\` clone, \`codef\` find files and folders, \`coden\` new window. Set a Hotkey for recent projects.

Works with VS Code, Insiders, Cursor, Windsurf, Zed, VSCodium and other VS Code forks: pick yours in the Workflow's Configuration.

This workflow was built with the help of AI tools. Review it before use, and report issues on the project page.`;

export const infoPlist = {
  bundleid: "com.izsk.vscode",
  name: "VS Code",
  createdby: "izsk",
  description: "Recent projects, extensions and git clone for VS Code, Cursor, Zed and friends",
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-vscode",
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
