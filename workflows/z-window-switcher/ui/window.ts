import { dashboard, type Json } from "../../../shared/dashboard.ts";
const ui = dashboard({
  bundle: "com.izsk.window-switcher",
  cli: "wins",
  title: "Window Switcher",
  placeholder: "Search window titles or apps…",
  primary: "Switch  ↩",
});
export const toolWindow = ui.window;
export const components = (query = ""): Json[] => {
  const values = ui.components(query);

  return values;
};
