import { hyperConfiguration } from "../../../shared/ui-profile.ts";
import pkg from "../package.json" with { type: "json" };
const text = (variable: string, label: string, value: string, description: string) => ({
  type: "textfield",
  variable,
  label,
  description,
  config: { default: value, placeholder: value, required: false },
});
const checkbox = (variable: string, label: string, value: boolean, caption: string, description: string) => ({
  type: "checkbox",
  variable,
  label,
  description,
  config: { default: value, required: false, text: caption },
});
const object = (uid: string, type: string, config: object, version = 1) => ({ uid, type, version, config });
const keyword = (uid: string, variable: string, title: string, subtext: string) =>
  object(uid, "alfred.workflow.input.keyword", {
    keyword: `{var:${variable}}`,
    text: title,
    subtext,
    argumenttype: 1,
    withspace: true,
  });
/** Keyword variants reach the window as a prefixed launch argument. */
const prefix = (uid: string, value: string) =>
  object(uid, "alfred.workflow.utility.json", { json: JSON.stringify({ alfredworkflow: { arg: value } }) });
const link = (to: string) => [{ destinationuid: to, modifiers: 0, modifiersubtext: "", vitoclose: false }];
// LeetCode's langSlug values for the code-template languages.
const LANGUAGES: [string, string][] = [
  ["C++", "cpp"],
  ["Java", "java"],
  ["Python3", "python3"],
  ["Python", "python"],
  ["C", "c"],
  ["C#", "csharp"],
  ["JavaScript", "javascript"],
  ["TypeScript", "typescript"],
  ["PHP", "php"],
  ["Swift", "swift"],
  ["Kotlin", "kotlin"],
  ["Dart", "dart"],
  ["Go", "golang"],
  ["Ruby", "ruby"],
  ["Scala", "scala"],
  ["Rust", "rust"],
  ["Racket", "racket"],
  ["Erlang", "erlang"],
  ["Elixir", "elixir"],
];
export const infoPlist = {
  bundleid: "com.izsk.leetcode",
  name: "LeetCode",
  createdby: "izsk",
  category: "Productivity",
  disabled: false,
  version: pkg.version,
  description: pkg.description,
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-leetcode",
  objects: [
    keyword("KEYWORD", "kw_main", "Search LeetCode Problems", "Search and preview LeetCode problems"),
    keyword("KW_DAILY", "kw_daily", "LeetCode Daily Challenge", "Today’s daily challenge problem"),
    prefix("DAILY_ARG", "daily:"),
    keyword(
      "KW_RANDOM",
      "kw_random",
      "Random LeetCode Problem",
      "Pick a random problem (filters in Actions)",
    ),
    prefix("RANDOM_ARG", "random:"),
    keyword(
      "KW_USER",
      "kw_user",
      "LeetCode User Profile",
      "Solve stats, streak, contest rating · type a username",
    ),
    prefix("USER_ARG", "user:{query}"),
    object("TRIGGER", "alfred.workflow.trigger.external", { triggerid: "open", availableviaurlscheme: true }),
    object("MODE", "alfred.workflow.utility.json", {
      json: JSON.stringify({
        alfredworkflow: { arg: "{query}", config: { launchmode: "{var:launch_external}" } },
      }),
    }),
    object("UI", "alfred.workflow.userinterface.alfredui", {
      path: "leetcode.alfredui",
      stackview: true,
      launchmode: 0,
    }),
    object(
      "POST",
      "alfred.workflow.action.script",
      {
        script: "./bin/leetcode post",
        type: 11,
        scriptargtype: 1,
        escaping: 0,
        scriptfile: "",
        concurrently: false,
      },
      2,
    ),
  ],
  connections: {
    KEYWORD: link("MODE"),
    KW_DAILY: link("DAILY_ARG"),
    DAILY_ARG: link("MODE"),
    KW_RANDOM: link("RANDOM_ARG"),
    RANDOM_ARG: link("MODE"),
    KW_USER: link("USER_ARG"),
    USER_ARG: link("MODE"),
    TRIGGER: link("MODE"),
    MODE: link("UI"),
    UI: link("POST"),
  },
  uidata: Object.fromEntries(
    [
      ["KEYWORD", 0, 0],
      ["KW_DAILY", 0, 130],
      ["KW_RANDOM", 0, 260],
      ["KW_USER", 0, 390],
      ["TRIGGER", 0, 520],
      ["DAILY_ARG", 190, 150],
      ["RANDOM_ARG", 190, 280],
      ["USER_ARG", 190, 410],
      ["MODE", 380, 260],
      ["UI", 560, 260],
      ["POST", 760, 260],
    ].map(([id, x, y]) => [id, { xpos: x, ypos: y }]),
  ),
  userconfigurationconfig: [
    text("kw_main", "Search keyword", "leetcode", "Search and preview problems."),
    text("kw_daily", "Daily keyword", "leetdaily", "Open today’s daily challenge."),
    text("kw_random", "Random keyword", "leetrandom", "Pick a random problem with your last filters."),
    text(
      "kw_user",
      "Profile keyword",
      "leetuser",
      "Show a user’s profile; type a username or use the one below.",
    ),
    text(
      "username",
      "Username",
      "",
      "Your LeetCode username, the default for the profile. Public data only; no sign-in.",
    ),
    {
      type: "popupbutton",
      variable: "language",
      label: "Preferred language",
      description: "Listed first under Copy Code Template.",
      config: { default: "python3", pairs: LANGUAGES },
    },
    checkbox(
      "show_stats",
      "Problem stats",
      true,
      "Show difficulty, likes and acceptance",
      "Shown in the list and above and below the description.",
    ),
    checkbox(
      "show_ratings",
      "Ratings",
      true,
      "Show zerotrac community ratings",
      "Downloaded from GitHub once a day.",
    ),
    checkbox(
      "show_topics",
      "Topics",
      false,
      "Show topic tags in the preview",
      "Off by default: tags can hint at the solution.",
    ),
    ...hyperConfiguration(),
    text("actions_shortcut", "Actions shortcut", "⌘K", "Open actions."),
    text("node_path", "Node.js executable", "", "Optional absolute executable path."),
    {
      type: "popupbutton",
      variable: "launch_external",
      label: "Open window",
      config: {
        default: "0",
        pairs: [
          ["Inside Alfred", "0"],
          ["Separate window", "1"],
        ],
      },
    },
  ],
  variablesdontexport: ["username"],
  readme:
    "Search and preview LeetCode problems, the daily challenge, random problems and user profiles in a native Alfred window. Command-K for actions; Back (Hyper+B) returns one level or to Dev. Built with help from AI tools.",
};
