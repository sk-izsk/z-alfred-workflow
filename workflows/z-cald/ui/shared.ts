/** The same native search/list/footer pattern used by the other workflows. */
export type Json = Record<string, unknown>;
export const run = (args: string[], extra: Json = {}): Json => ({
  type: "script",
  src: "../bin/cald",
  args,
  ...extra,
});
export const json = (src: Json, variables?: Json): Json => ({
  type: "json",
  src,
  ...(variables && { variables }),
});
export const call = (src: string, args: string): Json => ({ type: "function", src, args });
export const on = (triggers: string | string[], action: Json | Json[]): Json => ({ triggers, action });
export const key = (shortcut: string, action: Json | Json[]): Json => ({ shortcut, action });
export const selected = (id: string): string => `{value:${id}.selected.uid}`;
export const label = (id: string, extra: Json = {}): Json => ({ id, type: "label", text: "", ...extra });
export const button = (id: string, text: string, action: Json | Json[], extra: Json = {}): Json => ({
  id,
  type: "button",
  text,
  bordered: false,
  events: [on("actioned", action)],
  ...extra,
});
export const hiddenKey = (id: string, shortcut: string, action: Json | Json[]): Json =>
  button(id, "", action, { shortcut, opacity: 0, constraints: { size: { width: 0, height: 0 } } });
export const back = run(["back"]);

/** Invisible shortcut controls live in an overlay, so inline spacing cannot add phantom margins. */
export const footer = (buttons: Json[], showIcon = false): Json => {
  const hidden = buttons.filter((item) => item.opacity === 0);
  const visible = buttons.filter((item) => item.opacity !== 0);
  const status = label("statusLabel", {
    text: "Loading…",
    colour: "secondaryLabelColor",
    font: { size: 11.5 },
    constraints: { region: "centre", position: "centre", stretch: "horizontal" },
  });
  return {
    type: "view",
    layout: "stack",
    constraints: { region: "bottom" },
    components: [
      {
        type: "view",
        layout: "border",
        padding: 14,
        background: { dark: "#00000033", light: "#0000000d" },
        components: [
          showIcon
            ? {
                type: "view",
                layout: "border",
                spacing: 7,
                constraints: { region: "centre", stretch: "horizontal" },
                components: [
                  {
                    type: "imageview",
                    image: { type: "file", src: "../icon.png", size: { width: 15, height: 15 } },
                    constraints: { region: "left", position: "centre" },
                  },
                  status,
                ],
              }
            : status,
          {
            type: "view",
            layout: "inline",
            spacing: 10,
            constraints: { region: "right", position: "centre" },
            components: [
              button("footerBack", "Back  {var:back_label}", back, { shortcut: "{var:back_shortcut}" }),
              ...visible,
            ],
          },
        ],
      },
      ...hidden,
      hiddenKey("closeWindowKey", "⌘W", json({ finish: {} })),
    ],
  };
};

export const header = (title: Json, right?: Json): Json => ({
  type: "view",
  layout: "border",
  padding: 14,
  spacing: 10,
  constraints: { region: "top" },
  components: [
    button("backButton", "‹", back, {
      font: { size: 26 },
      tooltip: "Back {var:back_label}",
      constraints: { region: "left", position: "centre" },
    }),
    { ...title, constraints: { region: "centre", position: "centre", stretch: "horizontal" } },
    ...(right ? [{ ...right, constraints: { region: "right", position: "centre" } }] : []),
  ],
});

export const selection = (cell: string, labels: string[]): Json => ({
  init: {
    [`${cell}.background`]: null,
    ...Object.fromEntries(
      labels.map((id, i) => [`${id}.colour`, i === 0 ? "labelColor" : "secondaryLabelColor"]),
    ),
  },
  selected: {
    [`${cell}.background`]: "alfredSelectedResultBackgroundColor",
    ...Object.fromEntries(labels.map((id) => [`${id}.colour`, "alfredSelectedResultTextColor"])),
  },
});

export const window = (
  title: string,
  root: Json,
  variables: Json = {},
  size: { width?: number; height?: number; minHeight?: number } = {},
): Json => ({
  bundleid: "com.izsk.calendar",
  log: { level: "error", internal: true },
  variablesconfig: {
    cal_query: { src: "args[0]", default: "", scriptenv: true },
    cal_day: { default: "", scriptenv: true },
    cal_navigation: { default: "[]", scriptenv: true },
    cal_search: { default: "", scriptenv: true },
    cal_item: { default: "", scriptenv: true },
    actions_shortcut: { src: "variable", default: "⌘K" },
    back_shortcut: { src: "variable", default: "⌃⌥⇧⌘B" },
    back_label: { default: "Hyper+B" },
    actions_label: { default: "⌘K" },
    ...variables,
  },
  window: {
    title,
    size: { height: size.height ?? 560 },
    minsize: { width: 620, height: size.minHeight ?? 480 },
    root: {
      type: "view",
      layout: "border",
      ...root,
      events: [
        ...((root.events as Json[] | undefined) || []),
        on("preload", json({ window: { resize: { width: size.width ?? 800 } } })),
      ],
      shortcuts: (root.shortcuts as Json[] | undefined) || [],
    },
  },
});

export const accessButton = button("accessButton", "Allow Access", run(["authorize"], { async: true }), {
  tooltip: "Request full calendar access",
  hidden: true,
  constraints: { size: { width: 0, height: 0 } },
});

export const privacyKey = hiddenKey(
  "privacyKey",
  "⇧⌘,",
  json({
    open: { type: "url", src: "x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars" },
  }),
);
