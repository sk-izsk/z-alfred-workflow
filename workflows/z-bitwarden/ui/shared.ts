/** Building blocks shared by every window. Plain objects → `<name>.alfredui/ui.json`. */
export type Json = Record<string, unknown>;

export const BIN = "../bin/bwa";

export const run = (args: string[], extra: Json = {}): Json => ({ type: "script", src: BIN, args, ...extra });
export const json = (src: Json, variables?: Json): Json => ({
  type: "json",
  src,
  ...(variables && { variables }),
});
export const call = (id: string, name: string): Json => ({ type: "function", src: id, args: name });
export const on = (triggers: string | string[], action: Json | Json[]): Json => ({ triggers, action });
export const key = (shortcut: string, action: Json | Json[]): Json => ({ shortcut, action });
export const closeWindow = json({ finish: {} });

/** Variables every window needs: secrets handed from sheets to scripts (env only, never args). */
export const secretVars: Json = {
  query: { src: "args[0]", default: "" },
  secret_input: { scriptenv: true, default: "" },
  secret_pin: { scriptenv: true, default: "" },
  // Binds a window's secrets to the unlock and account they were loaded under (see session.windowBinding).
  window_session: { scriptenv: true, default: "" },
  window_account: { scriptenv: true, default: "" },
};

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
    // Height only: wide symbols (key, card) keep their shape instead of being squeezed square.
    image: { type: "symbol", src, size: { height: 14 } },
    contenttintcolour: "secondaryLabelColor",
    ...extra,
  });

/** A label that sits centred in a horizontal row (badges, codes, footer). */
export const inlineLabel = (id: string, extra: Json = {}): Json =>
  centred({ id, type: "label", text: "", ...extra });

/** Big search field, like Alfred's own. */
export const searchField = (id: string, placeholder: string, list: string, enter: Json | Json[]): Json => ({
  id,
  type: "textfield",
  text: "{var:query}",
  placeholder,
  focus: true,
  bordered: false,
  focusring: false,
  font: { size: 28, weight: "light" },
  textinsets: { horizontal: 6, vertical: 6 },
  events: [on("changed", call(list, "filterdata")), on("actioned", enter)],
});

/** Footer bar: status on the left, action hints on the right (like Raycast's, but Alfred-coloured). */
/** Footer: status left, optional `centre` (e.g. the TOTP code), shortcuts right. */
export const footer = (items: Json[], centre?: Json): Json => footerView([backHint(), ...items], centre);

const footerView = (right: Json[], centre?: Json): Json => ({
  constraints: { region: "bottom" },
  type: "view",
  layout: "border",
  padding: 12,
  background: { dark: "#00000033", light: "#0000000d" },
  components: [
    {
      constraints: { region: "left", insets: { left: 6 } },
      type: "view",
      layout: "inline",
      spacing: 8,
      components: [
        { type: "imageview", image: { type: "file", src: "../icon.png", size: { width: 18, height: 18 } } },
        inlineLabel("statusLabel", {
          colour: "secondaryLabelColor",
          font: { size: 13 },
          text: "…",
          constraints: { size: { width: 230 } },
        }),
      ],
    },
    // Fixed width: labels keep the size they had when the window opened (empty), so a later code
    // would be cut to one character.
    ...(centre
      ? [{ ...centre, constraints: { region: "centre", position: "centre", size: { width: 170 } } }]
      : []),
    {
      constraints: { region: "right", insets: { right: 6 } },
      type: "view",
      layout: "inline",
      spacing: 10,
      components: right,
    },
  ],
});

export const footerButton = (id: string, text: string, action: Json | Json[], extra: Json = {}): Json =>
  centred({
    id,
    type: "button",
    text,
    bordered: false,
    font: { size: 13, weight: "medium" },
    events: [on("actioned", action)],
    ...extra,
  });

/** Standard list selection colours, taken from the user's Alfred theme. */
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

export const arrows = (list: string): Json[] => [
  key("↑", call(list, "selectprevious")),
  key("↓", call(list, "selectnext")),
];

/**
 * ⌘[ closes the window and reopens the `bw` menu (post.ts). Alfred closes UI windows on ⎋
 * itself, before any script runs, so ⎋ can't be used for "back".
 */
const back = key("{var:back_shortcut}", json({ finish: { variables: { bw_out: "back" } } }));

/** Footer hint for the back shortcut (every window shows it). */
export const backHint = (): Json =>
  footerButton(
    "backButton",
    "Back  {var:back_shortcut}",
    json({ finish: { variables: { bw_out: "back" } } }),
    { shortcut: "{var:back_shortcut}" },
  );

export const window = (root: Json, extra: Json = {}): Json => ({
  bundleid: "com.izsk.bitwarden",
  log: { level: "error", internal: true },
  ...extra,
  variablesconfig: {
    // Configurable in the Workflow's Configuration (⎋ can't be used: Alfred closes the window itself).
    back_shortcut: { src: "variable", default: "⌘[" },
    ...(extra.variablesconfig as Json | undefined),
  },
  window: {
    size: { height: 540 },
    minsize: { width: 620, height: 380 },
    title: "Bitwarden",
    root: {
      ...root,
      shortcuts: [...((root.shortcuts as Json[] | undefined) ?? []), back],
      // A fixed width in ui.json stops the window opening inside Alfred; resizing after launch works.
      events: [
        ...((root.events as Json[] | undefined) ?? []),
        on("preload", json({ window: { resize: { width: 780 } } })),
      ],
    },
  },
});
