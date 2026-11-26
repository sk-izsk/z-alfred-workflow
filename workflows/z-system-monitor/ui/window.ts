import { dashboard } from "../../../shared/dashboard.ts";
const ui = dashboard({
  bundle: "com.izsk.system-monitor",
  cli: "sysmon",
  title: "System Monitor",
  placeholder: "System, CPU, memory, disk, power or network…",
  details: true,
  primary: "Activity Monitor  ↩",
});
export const toolWindow = ui.window;
export const components = ui.components;
