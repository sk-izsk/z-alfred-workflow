import { divider, footer, footerButton, json, key, label, on, run, window } from "./shared.ts";

/** Cloning can take a while: show it, then run without freezing the window. */
const cloneNow = [
  json({ update: { ids: { statusLabel: { text: "Cloning…" } } } }),
  run(["clone-run", "{var:query}", "{value:cloneParent.text}"], { async: true }),
];
const preview = run(["clone-preview", "{var:query}", "{value:cloneParent.text}"]);

const caption = (text: string) => ({
  type: "label",
  text,
  colour: "secondaryLabelColor",
  constraints: { position: "right", size: { width: 110 } },
});

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

export const clone = window(
  "Clone Repository",
  {
    type: "view",
    layout: "border",
    events: [on("preload", run(["clone-init", "{var:query}"]))],
    shortcuts: [key("⌘O", choose)],
    components: [
      {
        constraints: { region: "top" },
        type: "view",
        layout: "inline",
        spacing: 12,
        padding: 20,
        components: [
          {
            type: "imageview",
            image: { type: "symbol", src: "square.and.arrow.down.on.square", size: { height: 30 } },
            contenttintcolour: "controlAccentColor",
            constraints: { position: "centre" },
          },
          {
            type: "view",
            layout: "inline",
            direction: "vertical",
            spacing: 2,
            constraints: { position: "centre" },
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
          insets: { left: 20, right: 20 },
        },
        type: "view",
        layout: "form",
        spacing: 10,
        components: [
          caption("Save to"),
          {
            type: "view",
            layout: "inline",
            spacing: 8,
            components: [
              {
                id: "cloneParent",
                type: "textfield",
                focus: true,
                focusring: false,
                placeholder: "~/Developer",
                textinsets: { horizontal: 6, vertical: 5 },
                constraints: { size: { width: 380 } },
                events: [on("typingstopped", preview), on("actioned", cloneNow)],
              },
              {
                type: "button",
                text: "Choose…",
                tooltip: "Pick a folder ⌘O",
                events: [on("actioned", choose)],
              },
            ],
          },
          caption("Folder"),
          label("cloneTarget", { colour: "secondaryLabelColor", font: { size: 12.5, monospaced: true } }),
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
