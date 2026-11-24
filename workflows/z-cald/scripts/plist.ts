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
    title: "Calendar",
    subtext: "Upcoming events, quick calendar, create an event…",
    runningsubtext: "Loading Calendar commands…",
    script: './bin/cald root "$1"',
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
const targets = ["agenda", "quick", "create"];
const route = add(
  "ROUTE",
  "utility.conditional",
  1,
  {
    conditions: targets.map((target) => ({
      inputstring: "{var:cal_target}",
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
  { script: "./bin/cald post", type: 11, scriptargtype: 1, escaping: 0, scriptfile: "", concurrently: false },
  1080,
  200,
);
const note = add(
  "NOTE",
  "output.notification",
  1,
  { title: "Calendar", text: "{query}", onlyshowifquerypopulated: true },
  1280,
  200,
);
link(post, note);
const windows = [
  {
    target: "agenda",
    keyword: "kw_agenda",
    title: "Upcoming Events",
    subtitle: "Search events and join meetings",
  },
  { target: "quick", keyword: "kw_quick", title: "Quick Calendar", subtitle: "Browse months and years" },
  {
    target: "create",
    keyword: "kw_create",
    title: "Create Event",
    subtitle: "Add an event to a calendar account",
  },
];
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
const userconfigurationconfig: Obj[] = [
  text("kw_main", "Calendar menu", "cal", "Search all Calendar commands."),
  text("kw_agenda", "Upcoming Events keyword", "cald", "Direct access to upcoming events."),
  text("kw_quick", "Quick Calendar keyword", "calq", "Direct access to the month view."),
  text("kw_create", "Create Event keyword", "calc", "Direct access to the event form."),
  {
    type: "popupbutton",
    variable: "agenda_view",
    label: "Default agenda view",
    description:
      "Meetings only shows events with Meet, Zoom, Teams or Webex links. Timed events includes in-person meetings; All events includes holidays.",
    config: {
      default: "meetings",
      pairs: [
        ["Meetings only", "meetings"],
        ["Timed events", "timed"],
        ["All events", "all"],
      ],
    },
  },
  text(
    "lookahead_days",
    "Upcoming days",
    "7",
    "Show events for the next 1–90 calendar days, including today.",
  ),
  {
    type: "popupbutton",
    variable: "week_start",
    label: "First day of week",
    description: "Quick Calendar week layout.",
    config: {
      default: "1",
      pairs: [
        ["Monday", "1"],
        ["Sunday", "0"],
      ],
    },
  },
  {
    type: "checkbox",
    variable: "show_weeks",
    label: "Show ISO week numbers",
    description:
      "ISO week numbers use Monday; with Sunday-first, the number belongs to the following Monday.",
    config: { default: true, text: "Show ISO week numbers" },
  },
  text("actions_shortcut", "Actions shortcut", "⌘K", "Open the selected item’s action menu."),
  text("back_shortcut", "Back shortcut", "⌘[", "Return to the Calendar menu."),
  {
    type: "popupbutton",
    variable: "launch_external",
    label: "Open windows",
    description: "Use Alfred’s window or a separate window.",
    config: {
      default: "0",
      pairs: [
        ["Inside Alfred", "0"],
        ["Separate window", "1"],
      ],
    },
  },
  text("node_path", "Node.js", "", "Optional absolute path to Node.js if it is not found automatically."),
];

export const infoPlist = {
  bundleid: "com.izsk.calendar",
  name: "Calendar",
  createdby: "izsk",
  category: "Productivity",
  disabled: false,
  description: "Quick calendar, upcoming meetings and event creation using macOS Calendar",
  version: pkg.version,
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-cald",
  objects,
  connections,
  uidata,
  userconfigurationconfig,
  variablesdontexport: [],
  readme: `## Usage

Search Calendar commands via the \`cal\` keyword. Type \`cal create\`, \`cal quick\` or \`cal upcoming\` to filter the menu.

Search upcoming events via the \`cald\` keyword. Use ↑/↓ to select an event and ↩ to join its meeting. Without a meeting link, Calendar opens on the event’s date. Use ⌘K for more actions and ⌘R to refresh.

Browse months via the \`calq\` keyword. ←/→ changes month; ⇧←/⇧→ changes year; ⌘T returns to today. ⌥←/⌥→ selects a day; ↩ opens its agenda; ⌘N creates an event for that date.

Create events via the \`calc\` keyword. Choose a calendar/account, fill the form and press ⌘↩. Dates use YYYY-MM-DD; times use 24-hour HH:MM in the Mac’s time zone. For all-day events, the end date is the last included day. Paste existing Meet, Zoom, Teams or Webex links; this version does not generate new conferences or send invitations.

Allow full access in System Settings → Privacy & Security → Calendars. Show Date in Calendar also uses Automation permission. Keywords, week layout, lookahead and shortcuts are in the Workflow’s Configuration.

The calendar icon and month-navigation inspiration are from Raycast Quick Calendar by fuksman and contributors (MIT). See THIRD_PARTY_NOTICES.md.

This workflow was built with the help of AI tools. Review it before use, and report issues on the project page.`,
};
