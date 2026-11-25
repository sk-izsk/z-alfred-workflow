import pkg from "../package.json" with { type: "json" };
const text = (variable: string, label: string, value: string, description: string) => ({
  type: "textfield",
  variable,
  label,
  description,
  config: { default: value, placeholder: value, required: false },
});
export const infoPlist = {
  bundleid: "com.izsk.kill-process",
  name: "Kill Process",
  createdby: "izsk",
  category: "Tools",
  disabled: false,
  version: pkg.version,
  description: pkg.description,
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-kill-process",
  objects: [
    {
      uid: "KEYWORD",
      type: "alfred.workflow.input.keyword",
      version: 1,
      config: {
        keyword: "{var:kw_main}",
        text: "Kill Process",
        subtext: "Find processes by name or PID; sort CPU and memory",
        argumenttype: 1,
        withspace: true,
      },
    },
    {
      uid: "TRIGGER",
      type: "alfred.workflow.trigger.external",
      version: 1,
      config: { triggerid: "open", availableviaurlscheme: true },
    },
    {
      uid: "MODE",
      type: "alfred.workflow.utility.json",
      version: 1,
      config: {
        json: JSON.stringify({
          alfredworkflow: { arg: "{query}", config: { launchmode: "{var:launch_external}" } },
        }),
      },
    },
    {
      uid: "UI",
      type: "alfred.workflow.userinterface.alfredui",
      version: 1,
      config: { path: "processes.alfredui", stackview: true, launchmode: 0 },
    },
    {
      uid: "POST",
      type: "alfred.workflow.action.script",
      version: 2,
      config: {
        script: "./bin/kproc post",
        type: 11,
        scriptargtype: 1,
        escaping: 0,
        scriptfile: "",
        concurrently: false,
      },
    },
  ],
  connections: Object.fromEntries(
    [
      ["KEYWORD", "MODE"],
      ["TRIGGER", "MODE"],
      ["MODE", "UI"],
      ["UI", "POST"],
    ].map(([a, b]) => [a, [{ destinationuid: b, modifiers: 0, modifiersubtext: "", vitoclose: false }]]),
  ),
  uidata: Object.fromEntries(
    ["KEYWORD", "TRIGGER", "MODE", "UI", "POST"].map((id, i) => [
      id,
      { xpos: i * 190, ypos: id === "TRIGGER" ? 180 : 40 },
    ]),
  ),
  userconfigurationconfig: [
    text("kw_main", "Keyword", "kill", "Direct access. Use at least three characters."),
    {
      type: "popupbutton",
      variable: "default_sort",
      label: "Sort processes by",
      description: "Highest usage first.",
      config: {
        default: "cpu",
        pairs: [
          ["CPU Usage", "cpu"],
          ["Memory Usage", "memory"],
        ],
      },
    },
    text(
      "refresh_seconds",
      "Refresh interval (seconds)",
      "3",
      "1–60 seconds between samples; 0 disables automatic refresh. CPU sampling takes about one second.",
    ),
    {
      type: "checkbox",
      variable: "search_paths",
      label: "Search executable paths",
      description: "Names and PIDs always match.",
      config: { default: true, text: "Include paths in search" },
    },
    {
      type: "checkbox",
      variable: "confirm_termination",
      label: "Confirm process actions",
      description: "Optional review dialog before process actions. Disabled by default.",
      config: { default: false, text: "Ask before Kill, Force Kill, group actions and restarts" },
    },
    text("actions_shortcut", "Actions shortcut", "⌘K", "Actions for the selected process."),
    text(
      "back_shortcut",
      "Back shortcut",
      "⌘[",
      "Close a sheet to its parent; from the process list return to Alfred search.",
    ),
    {
      type: "popupbutton",
      variable: "launch_external",
      label: "Open window",
      description: "Choose Alfred’s window or a separate window.",
      config: {
        default: "0",
        pairs: [
          ["Inside Alfred", "0"],
          ["Separate window", "1"],
        ],
      },
    },
    text(
      "node_path",
      "Node.js executable",
      "",
      "Optional absolute Node.js path if automatic discovery fails.",
    ),
  ],
  variablesdontexport: [],
  readme: `Type kill to browse processes; add a name or PID to filter. Sort by CPU or memory. The footer shows sampled system CPU and active+wired+compressed physical RAM usage. These are different measurements from per-process CPU and RSS.

Arrow keys navigate, Return kills immediately, Command-K opens actions, Command-R reloads and Command-[ goes Back one level. Back stays visible in every footer, including sheets. Force Kill, Restart, Force Restart, Kill All, Force Kill All and Copy Path are in Actions; restart is available only for app processes.

Kill requests termination with SIGTERM; Force Kill uses SIGKILL and may lose unsaved work. Kill All matches the exact executable path, not a text search. App restart targets processes in the app bundle and reopens only after they exit. Processes owned by other users, key macOS services and this workflow’s ancestors are protected. No sudo, shell command reconstruction or privilege escalation is used. PID identities are rechecked before signaling. Enable optional confirmation in Workflow Configuration if desired.

Requires macOS, Alfred 6 Powerpack and Node.js 22+ or Bun. All tools and metrics are local; no service or network is used. See the README and TESTING.md in the repository for details.

The icon and action inspiration are from Raycast Kill Process by rolandleth and contributors (MIT); see THIRD_PARTY_NOTICES.md. This workflow was built with the help of AI tools. Review it before use and report issues on the project page.`,
};
