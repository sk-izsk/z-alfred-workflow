/** Building blocks shared by every window. Plain objects → `<name>.alfredui/ui.json`. */
export type Json = Record<string, unknown>;

export const BIN = "../bin/vsc";
export const BUNDLE_ID = "com.izsk.vscode";

export const run = (args: string[], extra: Json = {}): Json => ({ type: "script", src: BIN, args, ...extra });
export const json = (src: Json, variables?: Json): Json => ({
  type: "json",
  src,
  ...(variables && { variables }),
});
export const call = (id: string, name: string): Json => ({ type: "function", src: id, args: name });
export const on = (triggers: string | string[], action: Json | Json[]): Json => ({ triggers, action });
export const key = (shortcut: string, action: Json | Json[]): Json => ({ shortcut, action });

/** The selected row's uid in a dataview. */
export const sel = (list: string): string => `{value:${list}.selected.uid}`;

export const label = (id: string, extra: Json = {}): Json => ({ id, type: "label", text: "", ...extra });

/** Things in a horizontal row are top-aligned by default; centre them on the text line. */
const centred = (extra: Json): Json => ({
  ...extra,
  constraints: { position: "centre", ...(extra.constraints as Json | undefined) },
});

export const symbol = (id: string, src: string, extra: Json = {}): Json =>
  centred({
    id,
    type: "imageview",
    image: { type: "symbol", src, size: { height: 13 } },
    contenttintcolour: "secondaryLabelColor",
    ...extra,
  });

export const inlineLabel = (id: string, extra: Json = {}): Json =>
  centred({ id, type: "label", text: "", ...extra });

/** A rounded tag, like Raycast's accessories (version, branch, "Installed"). */
export const pill = (id: string, components: Json[], tint = "#8080801f"): Json =>
  centred({
    id,
    type: "view",
    layout: "inline",
    spacing: 4,
    padding: 3,
    cornerradius: 5,
    background: tint,
    components,
  });

const backAction = json({ finish: { variables: { vsc_out: "back" } } });

/** "‹" before the search field: back to the `vsc` menu, like Raycast's back arrow. */
const backArrow: Json = {
  id: "backButton",
  type: "button",
  text: "‹",
  bordered: false,
  tooltip: "Back {var:back_shortcut}",
  font: { size: 26, weight: "light" },
  events: [on("actioned", backAction)],
};

/** Big search field, like Alfred's own. Typing filters the list locally unless `events` says otherwise. */
export const searchBar = (opts: {
  placeholder: string;
  list: string;
  enter: Json | Json[];
  /** Replaces the default events (filter on change, `enter` on ↩). */
  events?: Json[];
  right?: Json;
}): Json => ({
  constraints: { region: "top" },
  type: "view",
  layout: "border",
  padding: 12,
  spacing: 8,
  components: [
    { ...backArrow, constraints: { region: "left", position: "centre", insets: { left: 2 } } },
    {
      constraints: { region: "centre" },
      id: "searchField",
      type: "textfield",
      text: "{var:query}",
      placeholder: opts.placeholder,
      focus: true,
      bordered: false,
      focusring: false,
      font: { size: 24, weight: "light" },
      textinsets: { horizontal: 4, vertical: 6 },
      events: opts.events ?? [on("changed", call(opts.list, "filterdata")), on("actioned", opts.enter)],
    },
    ...(opts.right ? [{ ...opts.right, constraints: { region: "right", position: "centre" } }] : []),
  ],
});

/** Small grey heading above the list ("Recent Projects", "Installed Extensions"). */
export const sectionTitle = (id: string, text: string): Json => ({
  id,
  type: "label",
  text,
  colour: "secondaryLabelColor",
  font: { size: 11.5, weight: "medium" },
});

export const footerButton = (id: string, text: string, action: Json | Json[], extra: Json = {}): Json =>
  centred({
    id,
    type: "button",
    text,
    bordered: false,
    font: { size: 12.5, weight: "medium" },
    events: [on("actioned", action)],
    ...extra,
  });

/** Footer: editor icon + status on the left, the primary action and Actions on the right. */
export const footer = (right: Json[]): Json => ({
  constraints: { region: "bottom" },
  type: "view",
  layout: "border",
  padding: 10,
  background: { dark: "#00000033", light: "#0000000d" },
  components: [
    {
      constraints: { region: "left", insets: { left: 6 } },
      type: "view",
      layout: "inline",
      spacing: 8,
      components: [
        // Static on purpose: an `update` that swaps an image makes Alfred drop the whole action.
        centred({
          type: "imageview",
          image: { type: "file", src: "../icon.png", size: { width: 18, height: 18 } },
        }),
        inlineLabel("statusLabel", {
          colour: "secondaryLabelColor",
          font: { size: 12.5 },
          text: "…",
          constraints: { size: { width: 300 } },
        }),
      ],
    },
    {
      constraints: { region: "right", insets: { right: 6 } },
      type: "view",
      layout: "inline",
      spacing: 10,
      components: right,
    },
  ],
});

/** A divider between footer hints: "Open in Code ↩ | Actions ⌘K". */
export const divider: Json = centred({
  type: "view",
  background: "separatorColor",
  constraints: { size: { width: 1, height: 14 } },
});

/** List selection colours, taken from the user's Alfred theme. */
export const selectionColours = (cellId: string, textIds: string[], symbolIds: string[] = []) => ({
  init: {
    [`${cellId}.background`]: null,
    ...Object.fromEntries(
      textIds.map((id, i) => [`${id}.colour`, i === 0 ? "labelColor" : "secondaryLabelColor"]),
    ),
    ...Object.fromEntries(symbolIds.map((id) => [`${id}.contenttintcolour`, "secondaryLabelColor"])),
  },
  selected: {
    [`${cellId}.background`]: "alfredSelectedResultBackgroundColor",
    ...Object.fromEntries(textIds.map((id) => [`${id}.colour`, "alfredSelectedResultTextColor"])),
    ...Object.fromEntries(
      symbolIds.map((id) => [`${id}.contenttintcolour`, "alfredSelectedResultTextColor"]),
    ),
  },
});

/** Icon column + one line "Title  dim detail" + accessories on the right (Raycast's list row). */
export const row = (opts: { right: Json[]; doubleClick: Json }): Json => ({
  id: "rowCell",
  type: "view",
  layout: "border",
  padding: 6,
  spacing: 10,
  cornerradius: 8,
  events: [on("doubleclicked", opts.doubleClick)],
  components: [
    {
      id: "rowIcon",
      type: "imageview",
      resize: "fit",
      image: { type: "symbol", src: "folder", size: { height: 20 } },
      constraints: {
        region: "left",
        position: "centre",
        size: { width: 24, height: 24 },
        insets: { left: 4 },
      },
    },
    {
      // Border layout, not inline: a horizontal inline view centres its content.
      constraints: { region: "centre", stretch: "horizontal" },
      type: "view",
      layout: "border",
      spacing: 8,
      components: [
        inlineLabel("rowTitle", {
          font: { size: 14, weight: "medium" },
          constraints: { region: "left", position: "centre" },
        }),
        inlineLabel("rowDetail", {
          colour: "secondaryLabelColor",
          font: { size: 13 },
          textalign: "left",
          constraints: { region: "centre", position: "centre", stretch: "horizontal" },
        }),
      ],
    },
    {
      constraints: { region: "right", position: "centre", insets: { right: 4 } },
      type: "view",
      layout: "inline",
      spacing: 8,
      components: opts.right,
    },
  ],
});

/** The list. `filter: false` for remote results (the Marketplace already filtered them). */
export const list = (cell: Json, placeholder: string, filter = true): Json => ({
  constraints: { region: "centre" },
  id: "items",
  type: "dataview",
  padding: 6,
  spacing: 2,
  placeholder,
  behaviour: { selection: { wrap: "none" } },
  data: {
    type: "basic",
    src: [],
    ...(filter && {
      filter: {
        type: "basic",
        args: "match",
        match: "{value:searchField.text}",
        matchmode: "wordmatchanyorder",
      },
    }),
  },
  cell: { height: 38, ...cell },
});

/** Heading + list stacked in the centre region. */
export const body = (heading: Json, listView: Json): Json => ({
  constraints: { region: "centre" },
  type: "view",
  layout: "border",
  components: [
    {
      ...heading,
      textalign: "left",
      constraints: { region: "top", stretch: "horizontal", insets: { left: 20, top: 2 } },
    },
    listView,
  ],
});

export const arrows = (listId: string): Json[] => [
  key("↑", call(listId, "selectprevious")),
  key("↓", call(listId, "selectnext")),
];

/** ⌘[ (configurable) closes the window and reopens the `vsc` menu; ⎋ is Alfred's own close. */
const back = key("{var:back_shortcut}", backAction);

export const window = (title: string, root: Json, extra: Json = {}): Json => ({
  bundleid: BUNDLE_ID,
  log: { level: "error", internal: true },
  ...extra,
  variablesconfig: {
    query: { src: "args[0]", default: "" },
    back_shortcut: { src: "variable", default: "⌘[" },
    actions_shortcut: { src: "variable", default: "⌘K" },
    ...(extra.variablesconfig as Json | undefined),
  },
  window: {
    size: { height: 520 },
    minsize: { width: 620, height: 360 },
    title,
    root: {
      ...root,
      shortcuts: [...((root.shortcuts as Json[] | undefined) ?? []), back],
      // A fixed width in ui.json stops the window opening inside Alfred; resizing after launch works.
      events: [
        ...((root.events as Json[] | undefined) ?? []),
        on("preload", json({ window: { resize: { width: 760 } } })),
      ],
    },
  },
});
