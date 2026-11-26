import { dashboard, type Json } from "../../../shared/dashboard.ts";
import { modes } from "../src/lunar.ts";
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
const button = (text: string, cmd: string, args: string[] = [], extra: Json = {}): Json => ({
  type: "button",
  text,
  ...extra,
  events: [{ triggers: "actioned", action: ui.run(cmd, args) }],
});
const control = (name: string, label: string): Json => ({
  type: "view",
  layout: "border",
  spacing: 8,
  constraints: { region: "top" },
  components: [
    { type: "label", text: label, font: { size: 13 }, constraints: { region: "left", size: { width: 75 } } },
    {
      id: name,
      type: "textfield",
      text: "",
      placeholder: "0–100",
      constraints: { region: "centre" },
      events: [
        { triggers: "actioned", action: ui.run("set", [name, "{value:self.text}", "{var:lunarui_display}"]) },
      ],
    },
    {
      type: "view",
      layout: "inline",
      spacing: 6,
      constraints: { region: "right" },
      components: [
        button("−5", "set", [name, "-5", "{var:lunarui_display}"]),
        button("+5", "set", [name, "+5", "{var:lunarui_display}"]),
        button("Apply", "set", [name, `{value:${name}.text}`, "{var:lunarui_display}"]),
      ],
    },
  ],
});
export const components = (query = ""): Json[] => {
  const values = ui.components(query),
    body = values[1]!;
  body.components[1] = {
    type: "view",
    layout: "inline",
    direction: "vertical",
    padding: 14,
    spacing: 17,
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
      control("brightness", "Brightness"),
      control("contrast", "Contrast"),
      control("volume", "Volume"),
      {
        type: "view",
        layout: "inline",
        spacing: 5,
        components: [0, 25, 50, 75, 100].map((n) =>
          button(`${n}%`, "set", ["brightness", String(n), "{var:lunarui_display}"]),
        ),
      },
      {
        id: "inputPicker",
        type: "picker",
        items: [{ text: "Video input…", value: "" }],
        selected: "",
        constraints: { stretch: "horizontal" },
        events: [
          {
            triggers: "changed",
            action: ui.run("input", ["{value:self.selected.value}", "{var:lunarui_display}"]),
          },
        ],
      },
      {
        type: "label",
        text: "Adaptive mode · All displays",
        font: { size: 11 },
        colour: "secondaryLabelColor",
      },
      {
        id: "modePicker",
        type: "picker",
        items: modes.map((mode) => ({ text: mode, value: mode })),
        selected: "off",
        constraints: { stretch: "horizontal" },
        events: [{ triggers: "changed", action: ui.run("adaptive", ["{value:self.selected.value}"]) }],
      },
      {
        id: "presetPicker",
        type: "picker",
        items: [{ text: "Apply saved preset…", value: "" }],
        selected: "",
        constraints: { stretch: "horizontal" },
        events: [{ triggers: "changed", action: ui.run("preset", ["{value:self.selected.value}"]) }],
      },
      {
        id: "controlInfo",
        type: "label",
        text: "",
        font: { size: 11 },
        colour: "secondaryLabelColor",
        linebreak: "wordwrap",
        constraints: { stretch: "horizontal" },
      },
    ],
  };
  return values;
};
