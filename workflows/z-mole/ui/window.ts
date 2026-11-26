import { dashboard, type Json } from "../../../shared/dashboard.ts";
import { referenceCell } from "../../../shared/reference-rows.ts";
import type { State } from "../src/state.ts";
const ui = dashboard({
  bundle: "com.izsk.mole",
  cli: "moleui",
  title: "Mole",
  placeholder: "Search…",
  primary: "Open  ↩",
});
export const toolWindow = ui.window;
export const components = (s: State): Json[] => {
  const values = structuredClone(ui.components(s.query));
  values[0]!.components[0].placeholder =
    s.mode === "analyze" ? `Browsing ${s.path}…` : s.mode === "clean" ? "Search cleanable items…" : "Search…";
  values[0]!.components[0].enabled = s.mode === "menu" || !!s.ready;
  values[0]!.components[0].events[1].action = ui.run("open");
  values[0]!.components.unshift({
    type: "button",
    text: "‹",
    bordered: false,
    font: { size: 24 },
    constraints: { region: "left", size: { width: 24 } },
    events: [{ triggers: "actioned", action: ui.run("back", [], false) }],
  });
  const list = values[1]!.components[0];
  list.cell = referenceCell("mole", 40);
  list.padding = 8;
  list.spacing = 2;
  if (s.mode === "status") {
    list.cell.root.components[0].components[2].components[1].constraints.size.width = 0;
    list.constraints = { region: "left", size: { width: 300 } };
    values[1]!.components.push({
      id: "details",
      type: "dataview",
      padding: 12,
      spacing: 2,
      data: { type: "basic", src: [] },
      constraints: { region: "centre" },
      cell: {
        height: 42,
        init: { "metricBadge.background": null, "metricValue.colour": "labelColor" },
        root: {
          type: "view",
          layout: "border",
          padding: 5,
          spacing: 10,
          components: [
            {
              id: "metricName",
              type: "label",
              text: "",
              font: { size: 12 },
              colour: "secondaryLabelColor",
              constraints: { region: "left", position: "centre", size: { width: 110 } },
            },
            {
              id: "metricBadge",
              type: "view",
              layout: "inline",
              padding: 4,
              cornerradius: 4,
              constraints: { region: "right", position: "centre" },
              components: [
                {
                  id: "metricValue",
                  type: "label",
                  text: "",
                  font: { size: 13, weight: "medium" },
                  textalign: "right",
                  linebreak: "truncatetail",
                },
              ],
            },
          ],
        },
      },
    });
  }
  values[2]!.components.unshift({
    id: "scanActivity",
    type: "progress",
    style: "round",
    progress: 0,
    opacity: 0,
    constraints: { region: "left", size: { width: 16, height: 16 } },
  });
  const footer = values[2]!.components.find(
    (c: Json) => c.type === "view" && c.layout === "inline",
  ).components;
  footer[1].enabled = s.mode === "menu" || !!s.ready;
  footer[1].text =
    s.mode === "status"
      ? "Refresh  ↩"
      : s.mode === "analyze"
        ? "Browse  ↩"
        : s.mode === "clean"
          ? "Clean All  ↩"
          : s.mode === "optimize"
            ? "Optimize All  ↩"
            : "Open  ↩";
  footer[1].events = [{ triggers: "actioned", action: ui.run("open") }];
  footer[2].events = [{ triggers: "actioned", action: ui.run("menu") }];
  return values;
};
