import { dashboard, type Json } from "../../../shared/dashboard.ts";
import { sliderHTML } from "../src/sliders.ts";
const ui = dashboard({
  bundle: "com.izsk.lunar",
  cli: "lunarui",
  title: "Lunar Controls",
  placeholder: "Search displays…",
  details: true,
  primary: "Open Lunar  ↩",
});
export const toolWindow = {
  ...ui.window,
  variablesconfig: { ...ui.window.variablesconfig, lunarui_display: { default: "" } },
};
export const components = (query = ""): Json[] => {
  const values = ui.components(query),
    body = values[1]!;
  const list = body.components[0];
  list.events = list.events.map((event: Json) =>
    event.triggers === "actioned"
      ? { ...event, action: ui.run("select", ["{value:self.selected.uid}"]) }
      : event,
  );
  values[0]!.components[0].events = values[0]!.components[0].events.map((event: Json) =>
    event.triggers === "actioned"
      ? { ...event, action: ui.run("select", ["{value:items.selected.uid}"]) }
      : event,
  );
  body.components[1] = {
    type: "view",
    layout: "inline",
    direction: "vertical",
    padding: 14,
    spacing: 11,
    constraints: { region: "centre", stretch: "horizontal" },
    components: [
      {
        id: "displayTitle",
        type: "label",
        text: "Select a display",
        font: { size: 18, weight: "semibold" },
        linebreak: "truncatetail",
        constraints: { stretch: "horizontal" },
      },
      {
        id: "sliders",
        type: "webkitview",
        text: sliderHTML(),
        constraints: { stretch: "horizontal", size: { height: 360 } },
        events: [{ triggers: "changed", action: ui.run("slider-change", ["{value:self.src}"]) }],
      },
    ],
  };
  return values;
};
