import { dashboard, type Json } from "../../../shared/dashboard.ts";
// The dashboard shell provides the launch window (loading label, Back, profile and launch events);
// the screens themselves are built in src/screens.ts and swapped in at runtime.
const ui = dashboard({
  bundle: "com.izsk.leetcode",
  cli: "leetcode",
  title: "LeetCode",
  placeholder: "Search LeetCode problems…",
  primary: "Preview Problem  ↩",
});
ui.window.variablesconfig.dev_return = { default: "" };
delete (ui.window.variablesconfig as Json).swiss_return;
// Keyword variants (daily, random, profile) arrive as the launch argument.
export const toolWindow = JSON.parse(JSON.stringify(ui.window).replaceAll("swiss_return", "dev_return"));
export const run = ui.run;
