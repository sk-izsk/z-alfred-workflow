import pkg from "../package.json" with { type: "json" };

const text = (variable: string, label: string, value: string, description: string) => ({
  type: "textfield",
  variable,
  label,
  description,
  config: { default: value, placeholder: value, required: false },
});
const keyword = (uid: string, variable: string, title: string, subtext: string) => ({
  uid,
  type: "alfred.workflow.input.keyword",
  version: 1,
  config: { keyword: `{var:${variable}}`, text: title, subtext, argumenttype: 1, withspace: true },
});
const mode = (uid: string, value: string) => ({
  uid,
  type: "alfred.workflow.utility.argument",
  version: 1,
  config: { argument: "{query}", variables: { sw_mode: value } },
});
/** For other workflows and scripts: `run trigger "list" in workflow "com.izsk.splitwise"`. */
const trigger = (uid: string, id: string) => ({
  uid,
  type: "alfred.workflow.trigger.external",
  version: 1,
  config: { triggerid: id, availableviaurlhandler: false },
});
const link = (to: string) => [{ destinationuid: to, modifiers: 0, modifiersubtext: "", vitoclose: false }];

export const infoPlist = {
  bundleid: "com.izsk.splitwise",
  name: "Splitwise",
  createdby: "izsk",
  category: "Productivity",
  disabled: false,
  version: pkg.version,
  description: pkg.description,
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-splitwise",
  objects: [
    keyword("ADD", "kw_add", "Add Expense", "Pick a friend or group, then add an expense"),
    mode("ADDMODE", "add"),
    keyword("LIST", "kw_list", "List Expenses", "Search, review, change and delete Splitwise expenses"),
    mode("LISTMODE", "list"),
    trigger("ADDTRIGGER", "add"),
    trigger("LISTTRIGGER", "list"),
    {
      uid: "UI",
      type: "alfred.workflow.userinterface.alfredui",
      version: 1,
      config: { path: "splitwise.alfredui", stackview: true, launchmode: 0 },
    },
    {
      uid: "POST",
      type: "alfred.workflow.action.script",
      version: 2,
      config: {
        script: "./bin/sw post",
        type: 11,
        scriptargtype: 1,
        escaping: 0,
        scriptfile: "",
        concurrently: false,
      },
    },
  ],
  connections: {
    ADD: link("ADDMODE"),
    ADDTRIGGER: link("ADDMODE"),
    LISTTRIGGER: link("LISTMODE"),
    ADDMODE: link("UI"),
    LIST: link("LISTMODE"),
    LISTMODE: link("UI"),
    UI: link("POST"),
  },
  uidata: {
    ADD: { xpos: 30, ypos: 40 },
    ADDMODE: { xpos: 220, ypos: 60 },
    LIST: { xpos: 30, ypos: 180 },
    ADDTRIGGER: { xpos: 30, ypos: 320 },
    LISTTRIGGER: { xpos: 30, ypos: 440 },
    LISTMODE: { xpos: 220, ypos: 200 },
    UI: { xpos: 360, ypos: 120 },
    POST: { xpos: 560, ypos: 120 },
  },
  userconfigurationconfig: [
    text("kw_add", "Add Expense keyword", "split", "Friends and groups; Return adds an expense."),
    text("kw_list", "List Expenses keyword", "expenses", "Search and manage your latest expenses."),
    {
      type: "popupbutton",
      variable: "loading_limit",
      label: "Expenses to load",
      description: "How many of your latest expenses List Expenses loads.",
      config: {
        default: "250",
        pairs: [
          ["100", "100"],
          ["250", "250"],
          ["500", "500"],
          ["1000", "1000"],
        ],
      },
    },
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
  readme: `Splitwise in Alfred: add expenses with friends and groups, and search, review, change and delete your expenses.

Type split to see Recent, Friends and Groups with balances; Return opens Add Expense (description, category, date, currency, cost; split equally, you pay). Type expenses for your latest expenses with a detail pane: who paid, who owes, group, repeating and receipt. Actions (Command-K): Open in Splitwise (Command-O), Change Values (Command-E: description, date, cost, who paid, who owes), View Receipt (Command-Y), Reload (Command-R), Delete (Control-X, with confirmation).

First use asks for an API key: register an app at secure.splitwise.com/apps and paste its API key. It is stored in your macOS Keychain, not in Alfred's preferences. Actions → Disconnect removes it.

Dates accept 2026-01-04 12:00, today, yesterday 18:30, tomorrow, -3d or 6pm. Back (Hyper+B by default) goes back one screen; from the first screen it returns to Alfred's search.

Requires Alfred 6 Powerpack, macOS, Node.js 22+ or Bun, and an internet connection. Based on the Raycast Splitwise extension by ilian and contributors (MIT). This workflow was built with the help of AI tools. Review it before use and report issues on the project page.`,
};
