import pkg from "../package.json" with { type: "json" };

const text = (variable: string, label: string, value: string, description: string) => ({
  type: "textfield",
  variable,
  label,
  description,
  config: { default: value, placeholder: value, required: false },
});
const popup = (
  variable: string,
  label: string,
  value: string,
  pairs: [string, string][],
  description = "",
) => ({
  type: "popupbutton",
  variable,
  label,
  description,
  config: { default: value, pairs },
});
const check = (variable: string, label: string, value: boolean, caption: string, description = "") => ({
  type: "checkbox",
  variable,
  label,
  description,
  config: { default: value, text: caption },
});

/** Each command: keyword and External Trigger → Arg and Vars (`nt_mode`) → the one window. */
const COMMANDS = [
  [
    "SEARCH",
    "kw_search",
    "notion",
    "search",
    "Search Notion",
    "Search pages and databases; preview, open, create and edit",
  ],
  ["CREATE", "kw_create", "ncreate", "create", "Create Database Page", "Create a page in a Notion database"],
  [
    "CAPTURE",
    "kw_capture",
    "ncapture",
    "capture",
    "Quick Capture",
    "Save a URL to a Notion page as a bookmark or full page",
  ],
  [
    "NOTE",
    "kw_note",
    "nnote",
    "note",
    "Add Note",
    "Write a quick note into today's page inside your notes page",
  ],
  [
    "TEXT",
    "kw_text",
    "nadd",
    "text",
    "Add Text to Page",
    "Append or prepend text, with a date, to a Notion page",
  ],
] as const;

const link = (to: string) => [{ destinationuid: to, modifiers: 0, modifiersubtext: "", vitoclose: false }];

export const infoPlist = {
  bundleid: "com.izsk.notion",
  name: "Notion",
  createdby: "izsk",
  category: "Productivity",
  disabled: false,
  version: pkg.version,
  description: pkg.description,
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-notion",
  objects: [
    ...COMMANDS.flatMap(([uid, variable, , mode, title, subtext]) => [
      {
        uid,
        type: "alfred.workflow.input.keyword",
        version: 1,
        config: { keyword: `{var:${variable}}`, text: title, subtext, argumenttype: 1, withspace: true },
      },
      {
        uid: `${uid}T`,
        type: "alfred.workflow.trigger.external",
        version: 1,
        config: { triggerid: mode, availableviaurlhandler: false },
      },
      {
        uid: `${uid}M`,
        type: "alfred.workflow.utility.argument",
        version: 1,
        config: { argument: "{query}", variables: { nt_mode: mode } },
      },
    ]),
    {
      uid: "CONNECTT",
      type: "alfred.workflow.trigger.external",
      version: 1,
      config: { triggerid: "connect", availableviaurlhandler: false },
    },
    {
      uid: "CONNECTM",
      type: "alfred.workflow.utility.argument",
      version: 1,
      config: { argument: "{query}", variables: { nt_mode: "connect" } },
    },
    {
      uid: "UI",
      type: "alfred.workflow.userinterface.alfredui",
      version: 1,
      config: { path: "notion.alfredui", stackview: true, launchmode: 0 },
    },
    {
      uid: "POST",
      type: "alfred.workflow.action.script",
      version: 2,
      config: {
        script: "./bin/nt post",
        type: 11,
        scriptargtype: 1,
        escaping: 0,
        scriptfile: "",
        concurrently: false,
      },
    },
  ],
  connections: {
    ...Object.fromEntries(
      COMMANDS.flatMap(([uid]) => [
        [uid, link(`${uid}M`)],
        [`${uid}T`, link(`${uid}M`)],
        [`${uid}M`, link("UI")],
      ]),
    ),
    CONNECTT: link("CONNECTM"),
    CONNECTM: link("UI"),
    UI: link("POST"),
  },
  uidata: {
    ...Object.fromEntries(
      COMMANDS.flatMap(([uid], i) => [
        [uid, { xpos: 30, ypos: 30 + i * 130 }],
        [`${uid}T`, { xpos: 30, ypos: 90 + i * 130 }],
        [`${uid}M`, { xpos: 220, ypos: 60 + i * 130 }],
      ]),
    ),
    CONNECTT: { xpos: 30, ypos: 700 },
    CONNECTM: { xpos: 220, ypos: 700 },
    UI: { xpos: 400, ypos: 340 },
    POST: { xpos: 600, ypos: 340 },
  },
  userconfigurationconfig: [
    ...COMMANDS.map(([, variable, value, , title]) =>
      text(variable, `${title} keyword`, value, `Opens ${title}.`),
    ),
    popup(
      "primary_action",
      "Primary action (Search)",
      "notion",
      [
        ["Open in Notion", "notion"],
        ["Preview in Alfred", "preview"],
      ],
      "What Return does on a page in Search Notion.",
    ),
    popup("open_in", "Open pages in", "app", [
      ["Notion app (browser if not installed)", "app"],
      ["Browser", "browser"],
    ]),
    check("close_after_create", "Create Database Page", false, "Close the window after creating the page"),
    popup(
      "use_clipboard",
      "Use clipboard to autofill",
      "",
      [
        ["Don't use the clipboard", ""],
        ["Name (title)", "title"],
        ["Page content", "content"],
      ],
      "Create Database Page fills this from the clipboard.",
    ),
    text("notes_page_name", "Notes page", "NOTES", "Add Note writes into a daily page inside this page."),
    text(
      "note_date_format",
      "Daily page title",
      "yyyy-MM-dd",
      "Tokens: yyyy, MM, MMM, dd; e.g. dd MMM yyyy.",
    ),
    popup("note_style", "Note style", "bulleted", [
      ["Bulleted list", "bulleted"],
      ["To-do checkbox", "todo"],
      ["Plain paragraph", "paragraph"],
    ]),
    text("actions_shortcut", "Actions shortcut", "⌘K", "Open the Actions menu."),
    text(
      "back_shortcut",
      "Back shortcut",
      "⌃⌥⇧⌘B",
      "Go back one screen; the first screen returns to Alfred.",
    ),
    text("node_path", "Node.js executable", "", "Optional absolute path if automatic discovery fails."),
  ],
  variablesdontexport: [],
  readme: `Notion in Alfred: search, preview and open pages and databases, create database pages, capture URLs, add notes and append text.

Keywords (configurable): notion (Search Notion: Pinned, Recent and search results; databases open their pages with filter, sort, list or kanban view and visible properties), ncreate (Create Database Page with a field for every property), ncapture (Quick Capture: bookmark or full page), nnote (Add Note to today's page) and nadd (Add Text to Page). Actions (Command-K) on a page: Preview, Open in Notion or Browser, Edit Property, Append Content, Create New Page, Pin, Copy URL, Copy Formatted URL, Copy Title, Delete (moves to Notion's trash), Refresh and Manage Connection.

First use: create an internal integration at notion.so/my-integrations, paste its secret into the window (it is kept in your macOS Keychain), then share pages with it in Notion (⋯ → Connections).

Back (Hyper+B by default) goes back one screen; from the first screen it returns to Alfred's search.

Requires Alfred 6 Powerpack, macOS, Node.js 22+ or Bun, and an internet connection. Based on the Raycast Notion extension by Henri Chabrand and contributors (MIT). This workflow was built with the help of AI tools. Review it before use and report issues on the project page.`,
};
