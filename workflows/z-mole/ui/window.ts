import { dashboard } from "../../../shared/dashboard.ts";
const ui = dashboard({
  bundle: "com.izsk.mole",
  cli: "moleui",
  title: "Mole",
  placeholder: "Filter status, previews or disk entries…",
  details: true,
  primary: "Open  ↩",
});
export const toolWindow = ui.window;
export const components = ui.components;
