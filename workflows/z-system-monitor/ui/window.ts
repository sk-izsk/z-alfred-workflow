import { dashboard, type Json } from "../../../shared/dashboard.ts";
const ui = dashboard({
  bundle: "com.izsk.system-monitor",
  cli: "sysmon",
  title: "System Monitor",
  placeholder: "System, CPU, memory, disk, power or network…",
  details: true,
  primary: "Activity Monitor  ↩",
});
export const toolWindow = ui.window;
export const components = (query = ""): Json[] => {
  const values = ui.components(query),
    list = values[1]!.components[0];
  list.events = list.events.map((event: Json) =>
    event.triggers === "actioned"
      ? { ...event, action: ui.run("select", ["{value:self.selected.uid}"]) }
      : event,
  );
  return values;
};
