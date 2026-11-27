import pkg from "../package.json" with { type: "json" };
const object = (uid: string, type: string, config: object, version = 1) => ({ uid, type, version, config });
const link = (b: string) => ({ destinationuid: b, modifiers: 0, modifiersubtext: "", vitoclose: false });
const script = (command: string) => ({
  script: command,
  type: 11,
  scriptargtype: 1,
  escaping: 0,
  scriptfile: "",
  concurrently: false,
});
// No window: results show in Alfred's own list as you type, so there is no Back or Actions button.
export const infoPlist = {
  bundleid: "com.izsk.menubar",
  name: "Menu Bar",
  createdby: "izsk",
  category: "Productivity",
  disabled: false,
  version: pkg.version,
  description: pkg.description,
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-menubar",
  objects: [
    object(
      "KEYWORD",
      "alfred.workflow.input.scriptfilter",
      {
        keyword: "{var:kw_main}",
        title: "Menu Bar",
        subtext: "Search the menus of the app you are using",
        runningsubtext: "Reading menus…",
        script: './bin/menubar filter "$1"',
        scriptargtype: 1,
        type: 11,
        escaping: 102,
        scriptfile: "",
        withspace: true,
        argumenttype: 1,
        argumenttreatemptyqueryasnil: false,
        // The list is read once per opening; Alfred filters it as you type (word starts).
        alfredfiltersresults: true,
        alfredfiltersresultsmatchmode: 0,
        queuemode: 1,
        queuedelaymode: 0,
        queuedelayimmediatelyinitially: true,
        skipuniversalaction: true,
      },
      3,
    ),
    object("PRESS", "alfred.workflow.action.script", script('./bin/menubar press "$1"'), 2),
    object("TRIGGER", "alfred.workflow.trigger.external", { triggerid: "open", availableviaurlscheme: true }),
    object("OPEN", "alfred.workflow.action.script", script("./bin/menubar open"), 2),
  ],
  connections: {
    KEYWORD: [link("PRESS")],
    TRIGGER: [link("OPEN")],
  },
  uidata: Object.fromEntries(
    [
      ["KEYWORD", 0, 0],
      ["PRESS", 220, 0],
      ["TRIGGER", 0, 160],
      ["OPEN", 220, 160],
    ].map(([id, x, y]) => [id, { xpos: x, ypos: y }]),
  ),
  userconfigurationconfig: [
    {
      type: "textfield",
      variable: "kw_main",
      label: "Keyword",
      description: "Type it and a space to list the menus of the app in front.",
      config: { default: "m", placeholder: "m", required: true },
    },
    {
      type: "checkbox",
      variable: "show_disabled",
      label: "Unavailable items",
      description: "Also list menu items that are greyed out right now (they can't be clicked).",
      config: { default: false, required: false, text: "Show unavailable items" },
    },
    {
      type: "checkbox",
      variable: "show_apple_menu",
      label: "Apple menu",
      description: "Also list the Apple menu, which is the same in every app.",
      config: { default: false, required: false, text: "Include the Apple menu" },
    },
    {
      type: "textfield",
      variable: "node_path",
      label: "Node.js executable",
      description: "Optional absolute executable path.",
      config: { default: "", placeholder: "", required: false },
    },
  ],
  variablesdontexport: [],
  readme:
    "Search and click the menu bar items of the app you are using, right in Alfred's results. Type m and a space: every menu item shows with its menu and shortcut; type to filter by words, initials (nt finds New Tab) or menu names. ↩ clicks it, ⌘C copies its menu path. Needs Alfred's Accessibility access. Built with help from AI tools.",
};
