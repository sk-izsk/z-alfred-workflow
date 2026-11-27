// Layout follows the Open Maps brief: left sidebar 345 pt, map on the right, sizes from configuration.
export type Json = Record<string, unknown>;

export const SIDEBAR = 345;
export const PADDING = 12;
export const DEFAULT_WIDTH = 1180;
export const DEFAULT_MAP_HEIGHT = 620;
export const mapWidth = (windowWidth: number) => windowWidth - 2 * PADDING - SIDEBAR - PADDING;

const CLI = "../bin/zmap";
export const CARD = { light: "#0000000d", dark: "#ffffff12" };
const ACCENT = "controlAccentColor";
const MUTED = "secondaryLabelColor";

/** Every visible action sends the current field texts; missing stop fields resolve to "". */
export const FIELDS = [
  "{value:von.text}",
  "{value:nach.text}",
  "{value:via0.text}",
  "{value:via1.text}",
  "{value:via2.text}",
];
export const run = (command: string, extra: string[] = []): Json => ({
  type: "script",
  src: CLI,
  args: [command, ...FIELDS, ...extra],
});
/** Network work runs after the visible answer, in the background. */
export const ROUTE: Json = { type: "script", src: CLI, args: ["route"], async: true };
export const act = (command: string, extra: string[] = []): Json[] => [run(command, extra), ROUTE];
export const on = (triggers: string, action: Json | Json[]): Json => ({ triggers, action });

const symbolButton = (
  id: string,
  symbol: string,
  size: number,
  action: Json | Json[],
  extra: Json = {},
): Json => ({
  id,
  type: "button",
  text: "",
  bordered: false,
  image: { type: "symbol", src: symbol, size: { width: size, height: size } },
  contenttintcolour: MUTED,
  events: [on("actioned", action)],
  ...extra,
});

export const field = (id: string, placeholder: string, size: number, extra: Json = {}): Json => ({
  id,
  type: "textfield",
  placeholder,
  bordered: false,
  focusring: false,
  background: null,
  textinsets: { horizontal: 10, vertical: 8 },
  font: { size },
  constraints: { size: { width: 277 } },
  events: [
    // ↩ takes the highlighted suggestion if there is one, otherwise routes.
    on("actioned", act("enter")),
    on("typingstopped", { type: "script", src: CLI, args: ["suggest", ...FIELDS, id], async: true }),
  ],
  ...extra,
});
const divider = (id: string): Json => ({
  id,
  type: "view",
  background: "separatorColor",
  constraints: { size: { width: 277, height: 1 } },
});

/** Stop fields between From and To; replaced as a whole (a replaced field loses its cursor). */
export const viaSlot = (texts: string[], placeholder: (n: number) => string, size: number): Json => ({
  id: "viaSlot",
  type: "view",
  layout: "inline",
  direction: "vertical",
  components: texts.flatMap((text, i) => [
    field(`via${i}`, placeholder(i + 1), size, { text }),
    divider(`viaDivider${i}`),
  ]),
});

const modeSymbols = ["car.fill", "tram.fill", "bicycle", "figure.walk"];
const modesCard = (row: number): Json => ({
  id: "modesCard",
  type: "view",
  layout: "grid",
  rows: 2,
  cols: 4,
  padding: 6,
  spacing: 2,
  cornerradius: 10,
  background: CARD,
  constraints: { grid: { col: 0, row, colweight: 1 } },
  components: [
    ...modeSymbols.map((symbol, i) =>
      symbolButton(`modeBtn${i}`, symbol, 20, act("mode", [String(i)]), {
        shortcut: `⌘${i + 1}`,
        contenttintcolour: i === 1 ? ACCENT : MUTED,
      }),
    ),
    ...modeSymbols.map((_, i) => ({
      id: `modeTime${i}`,
      type: "label",
      text: "–",
      textalign: "centre",
      font: { size: 13, weight: "bold" },
      colour: MUTED,
    })),
  ],
});

/** The sidebar below the fields; rebuilt on launch to add or drop the Home/Work row without a gap. */
export const rest = (quick: Json[], fonts: { duration: number; info: number }): Json => {
  const offset = quick.length ? 1 : 0;
  return {
    id: "rest",
    type: "view",
    layout: "flex",
    cols: 1,
    rows: 3 + offset,
    spacing: 10,
    constraints: { grid: { col: 0, row: 1, colweight: 1 }, size: { width: 330 } },
    components: [
      ...(quick.length
        ? [
            {
              id: "quick",
              type: "view",
              layout: "inline",
              spacing: 6,
              constraints: { grid: { col: 0, row: 0 }, position: "left" },
              components: quick,
            },
          ]
        : []),
      modesCard(offset),
      {
        id: "durationRow",
        type: "view",
        layout: "border",
        constraints: { grid: { col: 0, row: offset + 1, colweight: 1 } },
        components: [
          {
            id: "durationLabel",
            type: "label",
            text: "",
            font: { size: fonts.duration, weight: "bold" },
            constraints: { region: "centre", position: "left", stretch: "horizontal" },
          },
          {
            id: "altRow",
            type: "view",
            layout: "inline",
            spacing: 4,
            constraints: { region: "right", position: "centre" },
            components: [0, 1, 2].map((i) =>
              symbolButton(`alt${i}`, `${i + 1}.circle.fill`, 26, run("alt", [String(i)]), {
                hidden: true,
              }),
            ),
          },
        ],
      },
      {
        id: "infoLabel",
        type: "label",
        text: "",
        colour: MUTED,
        font: { size: fonts.info },
        linebreak: "truncatetail",
        constraints: {
          grid: { col: 0, row: offset + 2, colweight: 1 },
          position: "left",
          stretch: "horizontal",
        },
      },
    ],
  };
};

/** Text only: an SF Symbol next to the text overlapped it in a capsule button. */
export const quickButton = (id: string, text: string, action: Json[]): Json => ({
  id,
  type: "button",
  text,
  bordershape: "capsule",
  font: { size: 12.5 },
  events: [on("actioned", action)],
});

/** Collapsed dropdown: an empty view has no height, so there is no gap when nothing is suggested. */
export const emptySuggestions: Json = {
  id: "suggestSlot",
  type: "view",
  constraints: { position: "top", size: { width: 0, height: 0 } },
};
// Two lines (13 + 10.5 pt) need ~40 pt with padding, or the title and address touch.
export const SUGGEST_ROW = 40;
/** Four rows fit inside the modes area, so the floating card never needs more room. */
export const SUGGEST_MAX = 4;
/** Opaque, unlike the cards: text underneath must not show through. */
const MENU = { light: "#f5f5f7", dark: "#2a2b30" };

/**
 * The dropdown under the fields. ↓/↑ move a highlight drawn from row data; a click selects a row,
 * and that selection change picks the suggestion.
 */
export const suggestions = (rows: Json[]): Json => ({
  id: "suggestSlot",
  type: "view",
  layout: "stack",
  cornerradius: 10,
  padding: 4,
  background: MENU,
  border: { width: 1, colour: "separatorColor" },
  constraints: { position: "top", stretch: "horizontal", insets: { right: 15 } },
  components: [
    {
      id: "suggestList",
      type: "dataview",
      spacing: 0,
      behaviour: { selection: { allowempty: true } },
      constraints: { size: { width: 318, height: rows.length * SUGGEST_ROW } },
      data: { type: "basic", src: rows },
      events: [on("changed", act("choose", ["{value:suggestList.selected.uid}"]))],
      cell: {
        height: SUGGEST_ROW,
        init: { "sgRow.background": null, "sgTitle.colour": "labelColor", "sgDetail.colour": MUTED },
        selected: {},
        root: {
          id: "sgRow",
          type: "view",
          layout: "border",
          padding: 6,
          spacing: 8,
          cornerradius: 6,
          components: [
            {
              id: "sgIcon",
              type: "imageview",
              image: { type: "symbol", src: "mappin.circle.fill", size: { width: 18, height: 18 } },
              contenttintcolour: MUTED,
              constraints: { region: "left", position: "centre", size: { width: 22, height: 22 } },
            },
            {
              id: "sgText",
              type: "view",
              layout: "border",
              spacing: 2,
              constraints: { region: "centre" },
              components: [
                {
                  id: "sgTitle",
                  type: "label",
                  text: "",
                  font: { size: 13, weight: "medium" },
                  linebreak: "truncatetail",
                  constraints: { region: "top", position: "left", stretch: "horizontal" },
                },
                {
                  id: "sgDetail",
                  type: "label",
                  text: "",
                  font: { size: 10.5 },
                  linebreak: "truncatetail",
                  constraints: { region: "bottom", position: "left", stretch: "horizontal" },
                },
              ],
            },
          ],
        },
      },
    },
  ],
});

const steps: Json = {
  id: "steps",
  type: "dataview",
  spacing: 0,
  placeholder: "",
  behaviour: { selection: { allowempty: true } },
  constraints: { region: "centre", size: { width: 330 } },
  data: { type: "basic", src: [] },
  cell: {
    height: 21,
    init: {
      "stepRow.background": null,
      "bar.background": null,
      "dots.text": "",
      "stime.colour": "labelColor",
      "stext.colour": "labelColor",
    },
    // The highlight is row data from the script, not the dataview selection.
    selected: {},
    root: {
      id: "stepRow",
      type: "view",
      layout: "border",
      spacing: 8,
      cornerradius: 5,
      components: [
        {
          id: "stepLead",
          type: "view",
          layout: "inline",
          spacing: 6,
          constraints: { region: "left" },
          components: [
            { id: "bar", type: "view", constraints: { size: { width: 5, height: 21 } } },
            {
              id: "dots",
              type: "label",
              text: "",
              colour: MUTED,
              font: { size: 13 },
              constraints: { size: { width: 6 } },
            },
            {
              id: "stime",
              type: "label",
              text: "",
              font: { size: 13, weight: "bold", monospaced: "digits" },
              linebreak: "truncatetail",
              constraints: { size: { width: 46 } },
            },
          ],
        },
        {
          id: "stext",
          type: "label",
          text: "",
          font: { size: 13 },
          linebreak: "truncatetail",
          constraints: { region: "centre", position: "left", stretch: "horizontal" },
        },
      ],
    },
  },
};

const footerButton = (id: string, text: string, action: Json | Json[], extra: Json = {}): Json => ({
  id,
  type: "button",
  text,
  bordered: false,
  events: [on("actioned", action)],
  ...extra,
});

export const mapView = (width: number, height: number): Json => ({
  id: "mapBox",
  type: "view",
  layout: "stack",
  cornerradius: 12,
  cliptobounds: true,
  constraints: { region: "centre" },
  components: [
    {
      id: "map",
      type: "webkitview",
      text: "<html><body style='background:transparent'></body></html>",
      openlinksexternally: "^https?:",
      constraints: { size: { width, height } },
      events: [on("changed", { type: "script", src: CLI, args: ["pick", "{value:map.src}"] })],
    },
  ],
});

const BACK: Json = { type: "json", src: { finish: { variables: { map_out: "back" } } } };

export const mapWindow = {
  bundleid: "com.izsk.map",
  log: { level: "error", internal: true },
  variablesconfig: {
    map_query: { src: "args[0]", default: "" },
    // An API key typed into the key sheet reaches the script as env, never argv.
    map_key: { default: "", scriptenv: true },
    actions_shortcut: { src: "variable", default: "⌘K" },
    back_shortcut: { src: "variable", default: "⌃⌥⇧⌘B" },
    back_label: { default: "Hyper+B" },
    actions_label: { default: "⌘K" },
  },
  window: {
    title: "Maps",
    size: { width: DEFAULT_WIDTH },
    minsize: { width: 700, height: 400 },
    root: {
      id: "root",
      type: "view",
      layout: "border",
      padding: PADDING,
      spacing: PADDING,
      events: [
        on("preload", { type: "json", src: { window: { resize: { width: DEFAULT_WIDTH } } } }),
        on("launched", [{ type: "script", src: CLI, args: ["launch", "{var:map_query}"] }, ROUTE]),
      ],
      shortcuts: [
        { shortcut: "{var:actions_shortcut}", action: run("menu") },
        { shortcut: "⌘O", action: run("open") },
        { shortcut: "⌘T", action: act("swap") },
        { shortcut: "⌘U", action: run("add-stop") },
        { shortcut: "↓", action: run("suggest-move", ["1"]) },
        { shortcut: "↑", action: run("suggest-move", ["-1"]) },
      ],
      components: [
        {
          id: "left",
          type: "view",
          layout: "border",
          spacing: 10,
          constraints: { region: "left", size: { width: SIDEBAR } },
          components: [
            {
              id: "leftTop",
              type: "view",
              layout: "flex",
              cols: 1,
              rows: 2,
              spacing: 10,
              constraints: { region: "top" },
              components: [
                {
                  id: "fieldsBlock",
                  type: "view",
                  layout: "border",
                  padding: 4,
                  spacing: 2,
                  cornerradius: 10,
                  background: CARD,
                  constraints: { grid: { col: 0, row: 0, colweight: 1 }, insets: { right: 15 } },
                  components: [
                    symbolButton("swapButton", "arrow.up.arrow.down", 15, act("swap"), {
                      constraints: {
                        region: "left",
                        position: "centre",
                        size: { width: 26, height: 26 },
                      },
                      tooltip: "⌘T",
                    }),
                    {
                      id: "fieldStack",
                      type: "view",
                      layout: "inline",
                      direction: "vertical",
                      constraints: { region: "centre" },
                      components: [
                        field("von", "From", 15, { focus: true }),
                        divider("fieldDivider"),
                        {
                          id: "viaSlot",
                          type: "view",
                          layout: "inline",
                          direction: "vertical",
                          components: [],
                        },
                        field("nach", "To", 15),
                      ],
                    },
                    symbolButton("viaButton", "plus.circle.fill", 26, run("add-stop"), {
                      constraints: { region: "right", position: "centre" },
                      tooltip: "⌘U",
                    }),
                  ],
                },
                {
                  // The dropdown floats over the modes, right under the fields, like Google Maps:
                  // growing the column at runtime overlapped the fields inside Alfred.
                  id: "restStack",
                  type: "view",
                  layout: "stack",
                  constraints: { grid: { col: 0, row: 1, colweight: 1 } },
                  components: [rest([], { duration: 32, info: 14 }), emptySuggestions],
                },
              ],
            },
            steps,
          ],
        },
        mapView(mapWidth(DEFAULT_WIDTH), DEFAULT_MAP_HEIGHT),
        {
          id: "footer",
          type: "view",
          layout: "border",
          spacing: 12,
          constraints: { region: "bottom" },
          components: [
            {
              id: "statusLabel",
              type: "label",
              text: "",
              colour: MUTED,
              font: { size: 12.5 },
              linebreak: "truncatetail",
              constraints: { region: "centre", position: "left", stretch: "horizontal" },
            },
            {
              id: "footerButtons",
              type: "view",
              layout: "inline",
              spacing: 12,
              constraints: { region: "right" },
              components: [
                footerButton("footerBack", "Back  {var:back_label}", BACK, {
                  shortcut: "{var:back_shortcut}",
                }),
                footerButton("routeButton", "Route  ↩", act("enter")),
                footerButton("actionsButton", "Actions  {var:actions_label}", run("menu")),
                // ⇧⌘ shortcuts live on invisible buttons so the root view keeps ⌘ keys for the fields.
                footerButton("removeStopKey", "", run("remove-stop"), {
                  shortcut: "⇧⌘U",
                  opacity: 0,
                  constraints: { size: { width: 0, height: 0 } },
                }),
              ],
            },
          ],
        },
      ],
    },
  },
};
