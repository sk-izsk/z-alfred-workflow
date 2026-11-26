type Action = Record<string, unknown>;
export const standardSheet = (
  id: string,
  root: Action,
  _closeOnEscape = true,
  backAction?: Action,
  footerActions: Action[] = [],
): Action => {
  let back: Action = backAction ?? {
    type: "json",
    src: { sheet: { close: id } },
  };
  const children = (root.components as Action[] | undefined) || [];
  const isFooter = (c: Action): boolean =>
    (c.constraints as Action | undefined)?.region === "bottom" &&
    (c.type === "button" ||
      (c.type === "view" &&
        Array.isArray(c.components) &&
        (c.components as Action[]).every((v) => v.type === "button")));
  const extracted = children
    .filter(isFooter)
    .flatMap((c) => (c.type === "button" ? [c] : (c.components as Action[])));
  const primary = extracted
    .filter((c) => {
      if (!/^(Cancel|Back)\b/.test(String(c.text))) return true;
      if (!backAction) back = ((c.events as Action[] | undefined)?.[0]?.action as Action) || back;
      return false;
    })
    .map((c) => ({
      ...c,
      bordered: false,
      constraints: undefined,
      ...(extracted.length === 1 && !c.shortcut ? { shortcut: "↩" } : {}),
    }));
  const content = { ...root, components: children.filter((c) => !isFooter(c)) };
  return {
    sheet: {
      id,
      closeonescape: true,
      root: {
        type: "view",
        layout: "border",
        spacing: 4,
        components: [
          {
            ...content,
            constraints: { ...(root.constraints as Action | undefined), region: "centre" },
          },
          {
            type: "view",
            layout: "inline",
            spacing: 10,
            constraints: { region: "bottom", position: "right", insets: { right: 16, bottom: 12 } },
            components: [
              {
                id: `${id}Back`,
                type: "button",
                text: "Back  {var:back_label}",
                bordered: false,
                shortcut: "{var:back_shortcut}",
                events: [{ triggers: "actioned", action: back }],
              },
              ...primary,
              ...footerActions,
              {
                id: `${id}Escape`,
                type: "button",
                text: "",
                bordered: false,
                opacity: 0,
                shortcut: "⎋",
                constraints: { size: { width: 0, height: 0 } },
                events: [
                  { triggers: "actioned", action: { type: "json", src: { sheet: { close: id } } } },
                ],
              },
            ],
          },
        ],
      },
    },
  };
};
