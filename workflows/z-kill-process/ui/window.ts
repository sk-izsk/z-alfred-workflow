export type Json = Record<string, unknown>;
export const run = (cmd: string, args: string[] = [], async = true): Json => ({
  type: "script",
  src: "../bin/kproc",
  args: [cmd, "{var:kp_session}", ...args],
  async,
});
export const json = (src: Json): Json => ({ type: "json", src });
export const on = (triggers: string, action: Json | Json[]): Json => ({ triggers, action });
export const button = (id: string, text: string, action: Json | Json[], extra: Json = {}): Json => ({
  id,
  type: "button",
  text,
  bordered: false,
  events: [on("actioned", action)],
  ...extra,
});
export const label = (id: string, text: string, extra: Json = {}): Json => ({
  id,
  type: "label",
  text,
  ...extra,
});
const chosen = "{value:items.selected.uid}";
const act = (verb: string) => run("action", [verb, chosen]);
const hidden = (id: string, shortcut: string, action: Json) =>
  button(id, "", action, { shortcut, opacity: 0, constraints: { size: { width: 0, height: 0 } } });
const symbol = (id: string, name: string, size = 14): Json => ({
  id,
  type: "imageview",
  image: { type: "symbol", src: name, size: { width: size, height: size } },
  contenttintcolour: "secondaryLabelColor",
  constraints: { size: { width: size, height: size } },
});
const usage = (id: string, name: string, icon: string, colour: string): Json => ({
  type: "view",
  layout: "inline",
  spacing: 7,
  components: [
    symbol(`${id}Icon`, icon),
    label(`${id}Value`, `${name} —`, {
      font: { size: 11.5 },
      colour: "secondaryLabelColor",
      constraints: { size: { width: 74 } },
    }),
    {
      id: `${id}Bar`,
      type: "progress",
      style: "linear",
      progress: 0,
      thickness: 7,
      colour,
      constraints: { size: { width: 78, height: 8 } },
    },
  ],
});
export const processWindow = {
  bundleid: "com.izsk.kill-process",
  log: { level: "error", internal: true },
  variablesconfig: {
    kp_session: { default: "", scriptenv: true },
    kp_query: { src: "args[0]", default: "", scriptenv: true },
    back_shortcut: { src: "variable", default: "⌘[" },
    actions_shortcut: { src: "variable", default: "⌘K" },
  },
  pulse: { src: "../bin/kproc", args: ["poll", "{var:kp_session}"], interval: 0, intervalmode: "delay" },
  window: {
    title: "Kill Process",
    size: { height: 590 },
    minsize: { width: 900, height: 420 },
    root: {
      type: "view",
      layout: "border",
      events: [
        on("preload", json({ window: { resize: { width: 1000 } } })),
        on("launched", run("launch")),
        on("quit", run("cleanup", [], false)),
      ],
      shortcuts: [
        { shortcut: "↑", action: { type: "function", src: "items", args: "selectprevious" } },
        { shortcut: "↓", action: { type: "function", src: "items", args: "selectnext" } },
        { shortcut: "{var:actions_shortcut}", action: act("menu") },
        { shortcut: "⌘R", action: run("poll") },
        { shortcut: "⌘F", action: json({ update: { ids: { searchField: { focus: true } } } }) },
      ],
      components: [
        {
          type: "view",
          layout: "border",
          padding: 16,
          spacing: 14,
          constraints: { region: "top" },
          components: [
            button("headerBack", "‹", json({ finish: { variables: { kp_out: "back" } } }), {
              font: { size: 27 },
              tooltip: "Back {var:back_shortcut}",
              constraints: { region: "left", position: "centre" },
            }),
            {
              id: "searchField",
              type: "textfield",
              text: "{var:kp_query}",
              placeholder: "Filter by name, PID or path…",
              background: null,
              bordered: false,
              focusring: false,
              focus: true,
              font: { size: 23, weight: "light" },
              constraints: { region: "centre" },
              events: [
                on("changed", run("filter", ["{value:self.text}", "{value:sortPicker.selected.value}"])),
                on("actioned", act("terminate")),
              ],
            },
            {
              type: "view",
              layout: "inline",
              spacing: 14,
              constraints: { region: "right", position: "centre" },
              components: [
                label("countLabel", "…", {
                  font: { size: 12 },
                  colour: "secondaryLabelColor",
                  textalign: "right",
                  constraints: { size: { width: 80 } },
                }),
                {
                  id: "sortPicker",
                  type: "picker",
                  constraints: { size: { width: 160 } },
                  bordered: false,
                  items: [
                    { text: "CPU Usage", value: "cpu" },
                    { text: "Memory Usage", value: "memory" },
                  ],
                  selected: "cpu",
                  events: [
                    on("changed", run("filter", ["{value:searchField.text}", "{value:self.selected.value}"])),
                  ],
                },
              ],
            },
          ],
        },
        {
          id: "items",
          type: "dataview",
          padding: 10,
          spacing: 3,
          placeholder: "Reading processes and system usage…",
          data: { type: "basic", src: [] },
          constraints: { region: "centre" },
          events: [on("changed", run("selected", [chosen], false)), on("actioned", act("terminate"))],
          cell: {
            height: 57,
            init: {
              "row.background": null,
              "rowName.colour": "labelColor",
              "rowPath.colour": "secondaryLabelColor",
              "rowCPU.colour": "secondaryLabelColor",
              "rowMemory.colour": "secondaryLabelColor",
            },
            selected: {
              "row.background": "alfredSelectedResultBackgroundColor",
              "rowName.colour": "alfredSelectedResultTextColor",
              "rowPath.colour": "alfredSelectedResultTextColor",
              "rowCPU.colour": "alfredSelectedResultTextColor",
              "rowMemory.colour": "alfredSelectedResultTextColor",
            },
            root: {
              id: "row",
              type: "view",
              layout: "border",
              padding: 9,
              spacing: 12,
              cornerradius: 8,
              events: [on("doubleclicked", run("action", ["terminate", "{data:uid}"]))],
              components: [
                {
                  id: "rowIcon",
                  type: "imageview",
                  image: { type: "symbol", src: "terminal", size: { width: 27, height: 27 } },
                  constraints: { region: "left", position: "centre", size: { width: 30, height: 30 } },
                },
                {
                  type: "view",
                  layout: "border",
                  spacing: 3,
                  constraints: {
                    region: "centre",
                    position: "centre",
                    stretch: "horizontal",
                    size: { height: 36 },
                  },
                  components: [
                    label("rowName", "", {
                      font: { size: 14, weight: "medium" },
                      linebreak: "truncatetail",
                      constraints: { region: "top" },
                    }),
                    label("rowPath", "", {
                      font: { size: 11.5 },
                      linebreak: "truncatetail",
                      colour: "secondaryLabelColor",
                      constraints: { region: "bottom" },
                    }),
                  ],
                },
                {
                  type: "view",
                  layout: "inline",
                  spacing: 7,
                  constraints: { region: "right", position: "centre" },
                  components: [
                    symbol("rowCPUIcon", "cpu"),
                    label("rowCPU", "", {
                      textalign: "right",
                      font: { size: 12 },
                      constraints: { size: { width: 63 } },
                    }),
                    symbol("rowMemoryIcon", "memorychip"),
                    label("rowMemory", "", {
                      textalign: "right",
                      font: { size: 12 },
                      constraints: { size: { width: 85 } },
                    }),
                  ],
                },
              ],
            },
          },
        },
        {
          type: "view",
          layout: "stack",
          constraints: { region: "bottom" },
          components: [
            {
              type: "view",
              layout: "border",
              spacing: 9,
              padding: 14,
              components: [
                label("statusLabel", "Live CPU and RAM usage", {
                  colour: "secondaryLabelColor",
                  font: { size: 11 },
                  linebreak: "truncatetail",
                  constraints: { region: "top", size: { height: 17 } },
                }),
                {
                  type: "view",
                  layout: "inline",
                  spacing: 20,
                  constraints: { region: "left", position: "centre" },
                  components: [
                    usage("ram", "RAM", "memorychip", "systemBlueColor"),
                    usage("cpu", "CPU", "cpu", "systemPurpleColor"),
                  ],
                },
                {
                  type: "view",
                  layout: "inline",
                  spacing: 12,
                  constraints: { region: "right", position: "centre" },
                  components: [
                    button(
                      "footerBack",
                      "Back  {var:back_shortcut}",
                      json({ finish: { variables: { kp_out: "back" } } }),
                      {
                        shortcut: "{var:back_shortcut}",
                      },
                    ),
                    button("killButton", "Kill  ↩", act("terminate")),
                    button("actionsButton", "Actions  {var:actions_shortcut}", act("menu")),
                  ],
                },
              ],
            },
            hidden("forceKey", "⌘↩", act("force")),
            hidden("restartKey", "⌥⌘R", act("restart")),
            hidden("forceRestartKey", "⌥⇧⌘R", act("force-restart")),
            hidden("allKey", "⌥↩", act("terminate-all")),
            hidden("forceAllKey", "⌥⇧↩", act("force-all")),
            hidden("copyPathKey", "⌥⌘C", act("copy-path")),
          ],
        },
      ],
    },
  },
};
