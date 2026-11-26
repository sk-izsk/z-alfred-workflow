/**
 * Builders for Alfred UI JSON actions. A script prints one of these on stdout and Alfred applies it
 * (update → functions → … → finish, in Alfred's fixed order).
 */
export type Action = Record<string, unknown>;

export const merge = (...actions: (Action | undefined | false)[]): Action => {
  const out: Action = {};
  for (const action of actions) {
    if (!action) continue;
    for (const [key, value] of Object.entries(action)) {
      const prev = out[key];
      const both = prev && typeof prev === "object" && value && typeof value === "object";
      out[key] =
        both && "ids" in (prev as Action)
          ? {
              ...(prev as object),
              ...(value as object),
              ids: { ...(prev as { ids: object }).ids, ...(value as { ids: object }).ids },
            }
          : both
            ? { ...(prev as object), ...(value as object) }
            : value;
    }
  }
  return out;
};

/** `relayout` resizes labels whose text got longer (otherwise Alfred truncates them). */
export const update = (ids: Record<string, Action>, relayout = false): Action => ({
  update: { ids, ...(relayout && { relayout: true }) },
});
export const fn = (ids: Record<string, string | string[]>): Action => ({ functions: { ids } });
export const vars = (variables: Record<string, unknown>): Action => ({ variables });
export const finish = (variables: Record<string, string> = {}, args = ""): Action => ({
  finish: { args, variables },
});
export const copy = (text: string): Action => ({ copy: { type: "text", src: text } });
export const open = (url: string): Action => ({ open: { type: "url", src: url } });
export const sound = (name: string): Action => ({ sound: { src: name } });
export const popup = (anchor: string, menu: Action[]): Action => ({ popupmenu: { src: anchor, menu } });
export const rows = (list: string, src: Action[]): Action =>
  merge(update({ [list]: { data: { src } } }), fn({ [list]: ["filterdata", "selectfirst"] }));

/** Status line in the footer of every window. */
export const status = (text: string, colour = "secondaryLabelColor"): Action =>
  update({ statusLabel: { text, colour } }, true);

export const errorStatus = (error: unknown): Action =>
  merge(status(error instanceof Error ? error.message : String(error), "systemRedColor"), sound("Basso"));

/** A script action that calls our CLI. */
export const script = (args: string[], async = false): Action => ({
  type: "script",
  src: "../bin/sysmon",
  args,
  ...(async && { async: true }),
});

/** Menu text with its shortcut hint, right-aligned by a tab like a native menu. */
export const menuItem = (text: string, args: string[], hint = ""): Action => ({
  text: hint ? `${text}   ${hint}` : text,
  action: script(args),
});
export const separator: Action = { type: "separator" };

export const print = (action: Action): void => {
  process.stdout.write(JSON.stringify(action));
};

export { standardSheet as sheet } from "../../../shared/sheet.ts";
