import type { State } from "../src/model.ts";
import { dashboardHTML, detailHTML, rows } from "../src/presentation.ts";
export type Json = Record<string, unknown>;
export const run = (command: string, args: string[] = [], async = false): Json => ({
  type: "script",
  src: "../bin/spt",
  args: [command, "{var:session}", ...args],
  async,
});
export const on = (triggers: string, action: Json | Json[]): Json => ({ triggers, action });
const json = (src: Json): Json => ({ type: "json", src });
const button = (id: string, text: string, action: Json, shortcut?: string): Json => ({
  id,
  type: "button",
  text,
  bordered: false,
  ...(shortcut && { shortcut }),
  events: [on("actioned", action)],
});
const selected = "{value:results.selected.uid}";
const web = (id: string, text: string, region = "centre"): Json => ({
  id,
  type: "webkitview",
  text,
  openlinksexternally: true,
  constraints: { region, size: { height: 480 } },
});
export const body = (
  s: State,
  mode: string,
  details: boolean,
  selection: string,
  meterPath?: string,
): Json[] => {
  if (s.phase === "error")
    return [
      {
        type: "view",
        layout: "border",
        padding: 32,
        constraints: { region: "centre" },
        components: [
          {
            type: "imageview",
            image: { type: "symbol", src: "wifi.exclamationmark" },
            contenttintcolour: "secondaryLabelColor",
            constraints: { region: "top", position: "centre", size: { width: 64, height: 64 } },
          },
          {
            id: "errorMessage",
            type: "label",
            text: s.errorMessage || "Speedtest failed",
            font: { size: 17 },
            colour: "secondaryLabelColor",
            textalign: "centre",
            linebreak: "wordwrap",
            constraints: { region: "centre", position: "centre", stretch: "horizontal" },
          },
        ],
      },
    ];
  if (mode !== "list") {
    const dashboard = web("dashboard", dashboardHTML(s));
    if (meterPath) {
      delete dashboard.text;
      dashboard.src = meterPath;
    }
    return [dashboard];
  }
  return [
    {
      type: "view",
      layout: "border",
      padding: 10,
      constraints: { region: "centre" },
      spacing: 12,
      components: [
        {
          type: "view",
          layout: "border",
          constraints: { region: details ? "left" : "centre", ...(details && { size: { width: 330 } }) },
          components: [
            {
              type: "label",
              text: "Speedtest by Ookla",
              colour: "secondaryLabelColor",
              font: { size: 12 },
              constraints: { region: "top", insets: { bottom: 12, left: 8 } },
            },
            {
              id: "results",
              type: "dataview",
              select: selection,
              constraints: { region: "centre" },
              spacing: 2,
              data: {
                type: "basic",
                src: rows(s),
                filter: {
                  type: "basic",
                  args: "match",
                  match: "{value:searchField.text}",
                  matchmode: "wordmatchanyorder",
                },
              },
              events: [on("changed", run("select", [selected])), on("actioned", run("primary"))],
              cell: {
                height: 44,
                init: {
                  "row.background": null,
                  "rowTitle.colour": "labelColor",
                  "rowValue.colour": "secondaryLabelColor",
                },
                selected: {
                  "row.background": "alfredSelectedResultBackgroundColor",
                  "rowTitle.colour": "alfredSelectedResultTextColor",
                  "rowValue.colour": "alfredSelectedResultTextColor",
                },
                root: {
                  id: "row",
                  type: "view",
                  layout: "border",
                  padding: 8,
                  spacing: 10,
                  cornerradius: 10,
                  components: [
                    {
                      type: "view",
                      layout: "border",
                      spacing: 10,
                      constraints: { region: "left", size: { width: 128 } },
                      components: [
                        {
                          id: "rowIcon",
                          type: "imageview",
                          image: { type: "symbol", src: "globe", size: { width: 22, height: 22 } },
                          contenttintcolour: "systemBlueColor",
                          constraints: { region: "left", position: "centre" },
                        },
                        {
                          id: "rowTitle",
                          type: "label",
                          text: "",
                          font: { size: 15 },
                          constraints: { region: "centre", position: "left", stretch: "horizontal" },
                        },
                      ],
                    },
                    {
                      type: "view",
                      layout: "border",
                      constraints: { region: "centre" },
                      spacing: 5,
                      components: [
                        {
                          id: "rowProgress",
                          type: "progress",
                          style: "round",
                          progress: 0,
                          hidden: true,
                          constraints: {
                            region: "left",
                            size: { width: 16, height: 16 },
                            position: "centre",
                          },
                        },
                        {
                          id: "rowValue",
                          type: "label",
                          text: "",
                          font: { size: 14 },
                          textalign: "right",
                          linebreak: "truncatetail",
                          constraints: { region: "centre", position: "right", stretch: "horizontal" },
                        },
                      ],
                    },
                  ],
                },
              },
            },
          ],
        },
        ...(details ? [web("detail", detailHTML(s, selection))] : []),
      ],
    },
  ];
};
const hidden = (id: string, shortcut: string, command: string, args: string[] = []): Json => ({
  ...button(id, "", run(command, args, true), shortcut),
  opacity: 0,
  constraints: { size: { width: 0, height: 0 } },
});
export const speedtestWindow = {
  bundleid: "com.izsk.speedtest",
  log: { level: "error", internal: true },
  variablesconfig: {
    swiss_return: { default: "" },
    session: { default: "", scriptenv: true },
    speed_query: { default: "", scriptenv: true },
    launch_view: { src: "args[0]", default: "", scriptenv: true },
    back_shortcut: { src: "variable", default: "⌃⌥⇧⌘B" },
    back_label: { default: "Hyper+B" },
    actions_label: { default: "⌘K" },
    mode: { default: "meter", scriptenv: true },
    details: { default: "1", persist: true, scriptenv: true },
    selection: { default: "ping", scriptenv: true },
    last_phase: { default: "starting", scriptenv: true },
    actions_shortcut: { src: "variable", default: "⌘K" },
    appearance: { src: "variable", default: "automatic", scriptenv: true },
    speedtest_path: { src: "variable", default: "", scriptenv: true },
  },
  pulse: { src: "../bin/spt", args: ["poll", "{var:session}"], interval: 0 },
  window: {
    title: "Test Internet Speed",
    size: { height: 630 },
    minsize: { width: 760, height: 560 },
    root: {
      type: "view",
      layout: "border",
      events: [
        on("preload", json({ window: { resize: { width: 1040 } } })),
        on("launched", run("start")),
        on("quit", run("cancel")),
      ],
      shortcuts: [
        { shortcut: "{var:actions_shortcut}", action: run("actions") },
        { shortcut: "⌘R", action: run("restart") },
        { shortcut: "⌘L", action: run("view") },
        { shortcut: "↓", action: { type: "function", src: "results", args: "selectnext" } },
        { shortcut: "↑", action: { type: "function", src: "results", args: "selectprevious" } },
      ],
      components: [
        {
          type: "view",
          layout: "border",
          padding: 16,
          spacing: 12,
          constraints: { region: "top" },
          components: [
            {
              ...button("backButton", "‹", run("back")),
              font: { size: 28 },
              constraints: { region: "left" },
            },
            {
              id: "searchField",
              background: null,
              type: "textfield",
              placeholder: "Search…",
              focus: true,
              bordered: false,
              focusring: false,
              font: { size: 22 },
              constraints: { region: "centre" },
              events: [
                on("changed", [
                  json({ variables: { speed_query: "{value:searchField.text}" } }),
                  run("filter"),
                ]),
                on("actioned", run("primary")),
              ],
            },
          ],
        },
        {
          id: "body",
          type: "view",
          layout: "border",
          constraints: { region: "centre" },
          components: [
            {
              type: "label",
              text: "Starting Speedtest…",
              textalign: "centre",
              constraints: { region: "centre" },
            },
          ],
        },
        {
          type: "view",
          layout: "stack",
          constraints: { region: "bottom" },
          components: [
            {
              type: "view",
              layout: "border",
              padding: 14,
              components: [
                {
                  type: "label",
                  text: "🚀  Test Internet Speed",
                  colour: "secondaryLabelColor",
                  constraints: { region: "left", position: "centre" },
                },
                {
                  type: "view",
                  layout: "inline",
                  spacing: 16,
                  constraints: { region: "right" },
                  components: [
                    button("footerBack", "Back  {var:back_label}", run("back"), "{var:back_shortcut}"),
                    button("primaryButton", "Show Detailed List  ↩", run("primary"), "↩"),
                    button("actionsButton", "Actions  ⌘K", run("actions")),
                  ],
                },
              ],
            },
            {
              ...button(
                "closeWindowKey",
                "",
                json({
                  finish: { variables: { speedtest_out: "back", swiss_return: "{var:swiss_return}" } },
                }),
                "⌘W",
              ),
              opacity: 0,
              constraints: { size: { width: 0, height: 0 } },
            },
            {
              ...button("escapeWindowKey", "", json({ finish: {} }), "⎋"),
              opacity: 0,
              constraints: { size: { width: 0, height: 0 } },
            },
            hidden("copyKey", "⌘C", "copy-summary"),
            hidden("copySectionKey", "⇧⌘C", "copy-section"),
            hidden("openKey", "⌥↩", "open"),
            hidden("copyImageKey", "⌘D", "image", ["copy"]),
            hidden("pasteImageKey", "⇧⌘V", "image", ["paste"]),
            hidden("saveImageKey", "⇧⌘D", "image", ["save"]),
            hidden("clearKey", "⌃X", "clear-confirm"),
          ],
        },
      ],
    },
  },
};
