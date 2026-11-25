import { characterCount } from "../src/chunks.ts";
import type { State } from "../src/state.ts";
import { languages } from "../src/api.ts";
export type Json = Record<string, any>;
export const run = (cmd: string, args: string[] = [], async = true): Json => ({
  type: "script",
  src: "../bin/trns",
  args: [cmd, "{var:trns_session}", ...args],
  async,
});
const label = (id: string, text: string, extra: Json = {}): Json => ({ id, type: "label", text, ...extra });
const button = (id: string, text: string, action: Json, extra: Json = {}): Json => ({
  id,
  type: "button",
  text,
  bordered: false,
  events: [{ triggers: "actioned", action }],
  ...extra,
});
const picker = (id: string, value: string, source = false): Json => ({
  id,
  type: "picker",
  selected: value,
  items: languages
    .filter((l) => source || l.value !== "auto")
    .map((l) => ({ text: l.title, value: l.value })),
  constraints: { region: "centre", stretch: "horizontal" },
  events: [{ triggers: "changed", action: run(source ? "from" : "to", ["{value:self.selected.value}"]) }],
});
export const components = (s: State): Json[] => [
  {
    type: "view",
    layout: "grid",
    rows: 1,
    cols: 2,
    padding: 20,
    spacing: 24,
    constraints: { region: "centre" },
    components: [
      {
        type: "view",
        layout: "border",
        spacing: 16,
        components: [
          {
            type: "view",
            layout: "border",
            spacing: 12,
            constraints: { region: "top" },
            components: [
              label("fromLabel", "From", { colour: "secondaryLabelColor", constraints: { region: "left" } }),
              picker("fromPicker", s.from, true),
            ],
          },
          {
            id: "originalText",
            type: "textarea",
            text: s.query,
            editable: true,
            selectable: true,
            background: null,
            bordertype: "none",
            focus: true,
            font: { size: 20 },
            disableallsubstitutions: true,
            textinsets: { horizontal: 0, vertical: 8 },
            constraints: { region: "centre", size: { width: 350, height: 340 } },
            events: [
              {
                triggers: "changed",
                action: { type: "json", src: { update: { ids: { copyButton: { enabled: false } } } } },
              },
              { triggers: "typingstopped", action: run("query", ["{value:self.text}"]) },
            ],
          },
          label("sourceInfo", `${characterCount(s.query)} / 50,000 characters`, {
            font: { size: 12 },
            colour: "secondaryLabelColor",
            constraints: { region: "bottom", size: { height: 55 } },
          }),
        ],
      },
      {
        type: "view",
        layout: "border",
        spacing: 20,
        components: [
          { type: "view", background: "separatorColor", constraints: { region: "left", size: { width: 1 } } },
          {
            type: "view",
            layout: "border",
            spacing: 16,
            constraints: { region: "centre" },
            components: [
              {
                type: "view",
                layout: "border",
                spacing: 12,
                constraints: { region: "top" },
                components: [
                  label("toLabel", "To", { colour: "secondaryLabelColor", constraints: { region: "left" } }),
                  picker("toPicker", s.to),
                ],
              },
              {
                id: "resultText",
                type: "textarea",
                text: s.result?.text || "",
                editable: false,
                selectable: true,
                background: null,
                bordertype: "none",
                font: { size: 20 },
                textinsets: { horizontal: 0, vertical: 8 },
                constraints: { region: "centre", size: { width: 350, height: 340 } },
              },
              label("pronunciation", s.result?.pronunciation || "", {
                font: { size: 13 },
                colour: "secondaryLabelColor",
                linebreak: "wordwrap",
                constraints: { region: "bottom", size: { height: 55 } },
              }),
            ],
          },
        ],
      },
    ],
  },
  {
    type: "view",
    layout: "border",
    padding: 16,
    spacing: 12,
    constraints: { region: "bottom" },
    components: [
      label("statusLabel", s.status, {
        font: { size: 11 },
        colour: "secondaryLabelColor",
        linebreak: "truncatetail",
        constraints: { region: "centre", stretch: "horizontal" },
      }),
      {
        type: "view",
        layout: "inline",
        spacing: 12,
        constraints: { region: "right" },
        components: [
          button("back", "Back  {var:back_shortcut}", run("back", [], false), {
            shortcut: "{var:back_shortcut}",
          }),
          button("copyButton", "Copy  ⌘↩", run("copy", ["{value:originalText.text}"]), { shortcut: "⌘↩" }),
          button("actionsButton", "Actions  {var:actions_shortcut}", run("menu")),
        ],
      },
    ],
  },
];
export const toolWindow = {
  bundleid: "com.izsk.translate",
  variablesconfig: {
    swiss_return: { default: "" },
    trns_session: { default: "", scriptenv: true },
    trns_query: { src: "args[0]", default: "", scriptenv: true },
    back_shortcut: { src: "variable", default: "⌘[" },
    actions_shortcut: { src: "variable", default: "⌘K" },
  },
  window: {
    title: "Translate",
    size: { width: 940, height: 560 },
    root: {
      id: "root",
      type: "view",
      layout: "border",
      shortcuts: [
        { shortcut: "{var:actions_shortcut}", action: run("menu") },
        { shortcut: "⌘R", action: run("refresh") },
        { shortcut: "⌘L", action: run("swap") },
      ],
      events: [{ triggers: "launched", action: [run("prepare-origin", [], false), run("launch")] }],
      components: [
        label("statusLabel", "Loading Translate…", { constraints: { region: "centre", position: "centre" } }),
        button(
          "initialBack",
          "Back  {var:back_shortcut}",
          {
            type: "json",
            src: { finish: { variables: { trns_out: "back", swiss_return: "{var:swiss_return}" } } },
          },
          {
            shortcut: "{var:back_shortcut}",
            constraints: { region: "bottom", position: "left", insets: { left: 16, bottom: 16 } },
          },
        ),
      ],
    },
  },
};
