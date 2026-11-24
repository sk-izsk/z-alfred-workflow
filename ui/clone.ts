import { divider, footer, footerButton, json, key, label, on, run, window } from "./shared.ts";

/** Cloning can take a while: show it, then run without freezing the window. */
const cloneNow = [
  json({ update: { ids: { statusLabel: { text: "Cloning…" } } } }),
  run(["clone-run", "{var:query}", "{value:cloneParent.text}"], { async: true }),
];
const preview = run(["clone-preview", "{var:query}", "{value:cloneParent.text}"]);

/** Pick a folder in a native Open panel, then put it in the field. */
const choose = json({
  opendialog: {
    canchoosefiles: false,
    canchoosefolders: true,
    prompt: "Choose",
    message: "Where should the repository be cloned?",
    setvariable: "clone_pick",
    action: [json({ update: { ids: { cloneParent: { text: "{var:clone_pick}" } } } }), preview],
  },
});

/** A label + value line, both columns left-aligned at fixed widths. */
const line = (caption: string, value: Record<string, unknown>) => ({
  type: "view",
  layout: "border",
  spacing: 12,
  components: [
    {
      type: "label",
      text: caption,
      colour: "secondaryLabelColor",
      textalign: "right",
      constraints: { region: "left", position: "centre", size: { width: 64 } },
    },
    { ...value, constraints: { region: "centre", position: "centre", stretch: "horizontal" } },
  ],
});

export const clone = window(
  "Clone Repository",
  {
    type: "view",
    layout: "border",
    events: [on("launched", run(["clone-init", "{var:query}"]))],
    shortcuts: [key("⌘O", choose)],
    components: [
      {
        constraints: { region: "top", insets: { left: 24, right: 24, top: 20, bottom: 8 } },
        type: "view",
        layout: "border",
        spacing: 12,
        components: [
          {
            type: "imageview",
            image: { type: "symbol", src: "square.and.arrow.down.on.square", size: { height: 30 } },
            contenttintcolour: "controlAccentColor",
            constraints: { region: "left", position: "centre" },
          },
          {
            type: "view",
            layout: "inline",
            direction: "vertical",
            spacing: 2,
            constraints: { region: "centre", position: "left", stretch: "horizontal" },
            components: [
              label("cloneTitle", { text: "Clone Repository", font: { size: 18, weight: "semibold" } }),
              label("cloneRepo", { colour: "secondaryLabelColor", font: { size: 12.5 }, selectable: true }),
            ],
          },
        ],
      },
      {
        constraints: {
          region: "centre",
          position: "top",
          stretch: "horizontal",
          insets: { left: 24, right: 24, top: 8 },
        },
        type: "view",
        layout: "inline",
        direction: "vertical",
        spacing: 12,
        components: [
          line("Save to", {
            type: "view",
            layout: "border",
            spacing: 8,
            components: [
              {
                id: "cloneParent",
                type: "textfield",
                focus: true,
                focusring: false,
                placeholder: "~/Developer",
                textinsets: { horizontal: 6, vertical: 5 },
                constraints: { region: "centre", stretch: "horizontal" },
                events: [on("typingstopped", preview), on("actioned", cloneNow)],
              },
              {
                type: "button",
                text: "Choose…",
                tooltip: "Pick a folder ⌘O",
                constraints: { region: "right", position: "centre" },
                events: [on("actioned", choose)],
              },
            ],
          }),
          line(
            "Folder",
            label("cloneTarget", { colour: "secondaryLabelColor", font: { size: 12.5, monospaced: true } }),
          ),
        ],
      },
      footer([
        footerButton("primaryButton", "Clone and Open  ↩", cloneNow),
        divider,
        footerButton("chooseButton", "Choose Folder  ⌘O", choose),
      ]),
    ],
  },
  { variablesconfig: { clone_pick: { default: "" } } },
);
