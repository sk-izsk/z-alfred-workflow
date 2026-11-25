import pkg from "../package.json" with { type: "json" };

type Obj = Record<string, unknown>;
const objects: Obj[] = [],
  connections: Record<string, Obj[]> = {},
  uidata: Record<string, Obj> = {};
const add = (uid: string, type: string, version: number, config: Obj, x: number, y: number) => {
  objects.push({ uid, type: `alfred.workflow.${type}`, version, config });
  uidata[uid] = { xpos: x, ypos: y };
  return uid;
};
const link = (from: string, to: string, sourceoutputuid?: string) => {
  (connections[from] ??= []).push({
    destinationuid: to,
    modifiers: 0,
    modifiersubtext: "",
    vitoclose: false,
    ...(sourceoutputuid && { sourceoutputuid }),
  });
};

const main = add(
  "ROOT",
  "input.scriptfilter",
  3,
  {
    keyword: "{var:kw_main}",
    title: "Brew",
    subtext: "Search packages, upgrades, apps, services and taps…",
    runningsubtext: "Loading Homebrew commands…",
    script: './bin/brw root "$1"',
    scriptargtype: 1,
    type: 11,
    escaping: 102,
    scriptfile: "",
    withspace: true,
    argumenttype: 1,
    argumenttreatemptyqueryasnil: false,
    alfredfiltersresults: false,
    queuemode: 1,
    queuedelaymode: 0,
    queuedelayimmediatelyinitially: true,
    skipuniversalaction: true,
  },
  40,
  200,
);
const targets = [
  "installed",
  "search",
  "upgrades",
  "adopt",
  "services",
  "taps",
  "doctor",
  "vulns",
  "maintenance",
];
const route = add(
  "ROUTE",
  "utility.conditional",
  1,
  {
    conditions: targets.map((target) => ({
      inputstring: "{var:brew_target}",
      matchmode: 0,
      matchstring: target,
      matchcasesensitive: false,
      outputlabel: target,
      uid: `route-${target}`,
    })),
    hideelse: true,
    elselabel: "",
  },
  250,
  200,
);
link(main, route);
const post = add(
  "POST",
  "action.script",
  2,
  { script: "./bin/brw post", type: 11, scriptargtype: 1, escaping: 0, scriptfile: "", concurrently: false },
  1080,
  200,
);
const note = add(
  "NOTE",
  "output.notification",
  1,
  { title: "Brew", text: "{query}", onlyshowifquerypopulated: true },
  1280,
  200,
);
link(post, note);
const windows = targets.map((target) => ({
  target,
  keyword: `kw_${target}`,
  title: target[0]!.toUpperCase() + target.slice(1),
  subtitle: `Homebrew ${target}`,
}));
windows.forEach(({ target, keyword, title, subtitle }, i) => {
  const uid = target.toUpperCase(),
    y = i * 160;
  const kw = add(
    `${uid}KW`,
    "input.keyword",
    1,
    {
      keyword: `{var:${keyword}}`,
      text: title,
      subtext: subtitle,
      argumenttype: 1,
      withspace: true,
      skipuniversalaction: true,
    },
    460,
    y,
  );
  const trigger = add(
    `${uid}TRIGGER`,
    "trigger.external",
    1,
    { triggerid: target, availableviaurlscheme: false },
    460,
    y + 75,
  );
  const mode = add(
    `${uid}JSON`,
    "utility.json",
    1,
    {
      json: JSON.stringify({
        alfredworkflow: { arg: "{query}", config: { launchmode: "{var:launch_external}" } },
      }),
    },
    680,
    y,
  );
  const ui = add(
    `${uid}UI`,
    "userinterface.alfredui",
    1,
    { path: `${target}.alfredui`, stackview: true, launchmode: 0 },
    880,
    y,
  );
  link(kw, mode);
  link(trigger, mode);
  link(mode, ui);
  link(ui, post);
  link(route, mode, `route-${target}`);
});

const text = (variable: string, label: string, value: string, description: string) => ({
  type: "textfield",
  variable,
  label,
  description,
  config: { default: value, placeholder: value, required: false },
});
const aliases: Record<string, string> = {
  installed: "brewi",
  search: "brews",
  upgrades: "brewu",
  adopt: "brewa",
  services: "brewsvc",
  taps: "brewt",
  doctor: "brewd",
  vulns: "brewv",
  maintenance: "brewm",
};
const userconfigurationconfig: Obj[] = [
  text("kw_main", "Homebrew menu", "brew", "Search all Homebrew commands."),
  ...targets.map((target) =>
    text(
      `kw_${target}`,
      `${target} keyword`,
      aliases[target]!,
      "Direct access; keep keywords at least three characters.",
    ),
  ),
  text(
    "brew_path",
    "Homebrew executable",
    "",
    "Optional absolute path; standard Apple Silicon and Intel locations are detected.",
  ),
  {
    type: "checkbox",
    variable: "greedy_upgrades",
    label: "Include auto-updating casks",
    description: "Use Homebrew’s --greedy when checking and upgrading.",
    config: { default: false, text: "Include auto-updating and latest-version casks" },
  },
  {
    type: "popupbutton",
    variable: "terminal_app",
    label: "Run commands in",
    description: "Commands run visibly after review.",
    config: {
      default: "Terminal",
      pairs: [
        ["Terminal", "Terminal"],
        ["iTerm", "iTerm"],
      ],
    },
  },
  text("actions_shortcut", "Actions shortcut", "⌘K", "Open the selected entry’s action menu."),
  text("back_shortcut", "Back shortcut", "⌘[", "Return to the main Alfred search from every view and sheet."),
  {
    type: "popupbutton",
    variable: "launch_external",
    label: "Open windows",
    description: "Choose Alfred’s window or a separate window.",
    config: {
      default: "0",
      pairs: [
        ["Inside Alfred", "0"],
        ["Separate window", "1"],
      ],
    },
  },
  text("node_path", "Node.js", "", "Optional absolute path if Node.js is not detected."),
];

export const infoPlist = {
  bundleid: "com.izsk.brew",
  name: "Brew",
  createdby: "izsk",
  category: "Productivity",
  disabled: false,
  description: "Search and manage Homebrew packages, upgrades, apps, services and taps",
  version: pkg.version,
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-brew",
  objects,
  connections,
  uidata,
  userconfigurationconfig,
  variablesdontexport: [],
  readme: `## Usage

Type brew to search commands. Direct keywords: brewi installed, brews search, brewu upgrades, brewa adopt apps, brewd doctor, brewsvc services, brewt taps, brewv vulnerability scan, brewm maintenance.

Use arrow keys and Return; Command-K opens actions, Command-R refreshes. Filter formulae/casks and outdated, pinned or deprecated/disabled packages. Red warning icons indicate Homebrew’s deprecated or disabled status; orange indicates upgrades.

Changes require reviewing the exact command, then Run in Terminal. Refresh after the command finishes. No commands run until confirmed. Adoption candidates are guesses from app names and versions; preview first. Homebrew --adopt checks matching artifacts and may refuse an app. No force replacement is used.

Requires Alfred 6 Powerpack, Node.js or Bun, and an existing Homebrew installation. Homebrew 7+ is required for structured Doctor and vulnerability reports. Search downloads Homebrew’s public catalog; vulnerability scans contact Homebrew’s advisory sources. Configure executable paths and terminal in Workflow Configuration.

The Brew icon and feature inspiration are from Raycast Brew by nhojb and contributors (MIT). See THIRD_PARTY_NOTICES.md. This workflow was built with the help of AI tools. Review it before use and report issues on the project page.`,
};
