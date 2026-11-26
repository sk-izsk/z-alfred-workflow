/**
 * Builders for Alfred UI JSON actions. A script prints one of these objects on stdout
 * and Alfred applies it (update → functions → … → finish, in Alfred's fixed order).
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
export { standardSheet as sheet } from "../../../shared/sheet.ts";
export const closeSheet = (id: string): Action => ({ sheet: { close: id } });
export const finish = (variables: Record<string, string> = {}, args = ""): Action => ({
  finish: { args, variables },
});
export const sound = (name: string): Action => ({ sound: { src: name } });
export const open = (url: string): Action => ({ open: { type: "url", src: url } });
export const notify = (title: string, text: string): Action => ({ notification: { post: { title, text } } });
export const popup = (anchor: string, menu: Action[]): Action => ({ popupmenu: { src: anchor, menu } });

/** Status line in the footer of every view. */
export const status = (text: string, colour = "secondaryLabelColor"): Action =>
  update({ statusLabel: { text, colour } }, true);

export const errorStatus = (error: unknown): Action =>
  merge(status(error instanceof Error ? error.message : String(error), "systemRedColor"), sound("Basso"));

/** A script action that calls our CLI; secrets travel in `secret_input` (env), never args. */
export const script = (args: string[], async = false): Action => ({
  type: "script",
  src: "../bin/bwa",
  args,
  ...(async && { async: true }),
});

export const menuItem = (text: string, args: string[]): Action => ({ text, action: script(args) });
export const separator: Action = { type: "separator" };

export const print = (action: Action): void => {
  process.stdout.write(JSON.stringify(action));
};
