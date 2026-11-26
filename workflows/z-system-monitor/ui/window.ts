import { dashboard, type Json } from "../../../shared/dashboard.ts";
import { referenceCell } from "../../../shared/reference-rows.ts";
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
  const values = structuredClone(ui.components(query)),
    list = values[1]!.components[0];
  list.constraints.size.width = 280;
  list.cell = referenceCell("monitor", 44);
  list.cell.root.components[0].components[2].components[1].constraints.size.width = 0;
  const detail = values[1]!.components[1];
  detail.cell = referenceCell("metric", 40);
  detail.cell.root.components[0].components[2].components[1].constraints.size.width = 0;
  detail.cell.root.components[0].components.shift();
  detail.cell.root.components[0].components[0].components[0].constraints = { size: { width: 250 } };
  detail.cell.root.components[0].components[0].components[0].components[0].textalign = "right";
  detail.cell.root.components[0].components[0].components[0].components[0].linebreak = "truncatetail";
  detail.cell.root.components[0].components[0].components[0].layout = "border";
  detail.cell.root.components[0].components[0].components[0].components[0].constraints = { region: "centre" };
  list.cell.root.components[0].components[1].components[0].constraints = { size: { width: 70 } };
  list.events = list.events.map((event: Json) =>
    event.triggers === "actioned"
      ? { ...event, action: ui.run("select", ["{value:self.selected.uid}"]) }
      : event,
  );
  return values;
};
