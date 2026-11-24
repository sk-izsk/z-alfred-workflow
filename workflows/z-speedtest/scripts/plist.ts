import pkg from "../package.json" with { type: "json" };
const text = (variable: string, label: string, value: string, description: string) => ({
  type: "textfield",
  variable,
  label,
  description,
  config: { default: value, placeholder: value, required: false },
});
export const infoPlist = {
  bundleid: "com.izsk.speedtest",
  name: "Speed Test",
  createdby: "izsk",
  category: "Tools",
  disabled: false,
  description: "Live Ookla download and upload meters, ping, jitter and connection quality",
  version: pkg.version,
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-speedtest",
  objects: [
    {
      uid: "KEYWORD",
      type: "alfred.workflow.input.keyword",
      version: 1,
      config: {
        keyword: "{var:kw_main}",
        text: "Test Internet Speed",
        subtext: "Run Ookla Speedtest with live meters and connection details",
        argumenttype: 2,
        withspace: false,
      },
    },
    {
      uid: "HOTKEY",
      type: "alfred.workflow.trigger.hotkey",
      version: 2,
      config: { hotkey: 0, hotmod: 0, hotstring: "", argument: 0, action: 0, relatedAppsMode: 0 },
    },
    {
      uid: "EXTERNAL",
      type: "alfred.workflow.trigger.external",
      version: 1,
      config: { triggerid: "speedtest", availableviaurlscheme: false },
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
      config: { path: "speedtest.alfredui", stackview: true, launchmode: 0 },
    },
    {
      uid: "POST",
      type: "alfred.workflow.action.script",
      version: 2,
      config: {
        script: "./bin/spt post",
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
      ["HOTKEY", "MODE"],
      ["EXTERNAL", "MODE"],
      ["MODE", "UI"],
      ["UI", "POST"],
    ].map(([from, to]) => [
      from,
      [{ destinationuid: to, modifiers: 0, modifiersubtext: "", vitoclose: false }],
    ]),
  ),
  uidata: {
    KEYWORD: { xpos: 40, ypos: 40 },
    HOTKEY: { xpos: 40, ypos: 160 },
    EXTERNAL: { xpos: 40, ypos: 280 },
    MODE: { xpos: 260, ypos: 100 },
    UI: { xpos: 470, ypos: 100 },
    POST: { xpos: 680, ypos: 100 },
  },
  userconfigurationconfig: [
    text(
      "kw_main",
      "Speed Test keyword",
      "speedtest",
      "Use at least three characters. Starting a test accepts Ookla’s EULA and GDPR terms and can consume substantial bandwidth.",
    ),
    text(
      "speedtest_path",
      "Ookla Speedtest executable",
      "",
      "Optional absolute path. Detects /opt/homebrew/bin/speedtest and /usr/local/bin/speedtest. Install the official Ookla CLI yourself; Python speedtest-cli is incompatible.",
    ),
    text(
      "node_path",
      "Node.js executable",
      "",
      "Optional absolute path if Node.js is not detected. Bun is also supported.",
    ),
    text("actions_shortcut", "Actions shortcut", "⌘K", "Open the action menu."),
    {
      type: "popupbutton",
      variable: "appearance",
      label: "Chart appearance",
      description: "Match your Alfred theme if automatic detection differs.",
      config: {
        default: "automatic",
        pairs: [
          ["Automatic", "automatic"],
          ["Light", "light"],
          ["Dark", "dark"],
        ],
      },
    },
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
  ],
  variablesdontexport: [],
  readme: `## Usage
Test your connection via the speedtest keyword. A test starts immediately. Command-L switches between the live meter and detailed list; Return shows or hides section details. Command-K opens actions. Command-R restarts after completion or failure. Search and use arrow keys to select sections.

Copy summary (Command-C), section JSON (Shift-Command-C), or open the result (Option-Return). Copy meter image (Command-D), paste it into the previous app (Shift-Command-V), or save to Downloads (Shift-Command-D). Pasting requires macOS Accessibility permission for Alfred. Clear CLI Cache clears this workflow’s cached data and images; it preserves the external CLI.

Requires Alfred 6 Powerpack, Node.js or Bun, and the official Ookla Speedtest CLI (https://www.speedtest.net/apps/cli). No executable is downloaded by this workflow. Configure its path if needed. Starting a test accepts https://www.speedtest.net/about/eula and https://www.speedtest.net/about/gdpr. Tests contact Ookla and test servers, can use substantial bandwidth and generate shareable result URLs containing connection information. Frequent tests may be rate limited.

Adapted from Raycast Speedtest by Michael Aigner and contributors, MIT. See THIRD_PARTY_NOTICES.md.
This workflow was built with the help of AI tools. Review it before use, and report issues on the project page.`,
};
