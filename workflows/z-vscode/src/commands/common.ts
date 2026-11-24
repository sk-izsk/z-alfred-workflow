import { editor, shortName } from "../editors.ts";
import { type Action, menuItem, status, update } from "../ui.ts";

/**
 * "Open in Cursor ↩" etc. for the configured editor. Its own script on purpose: if Alfred rejects
 * part of an action it drops all of it, so this must never ride along with the list rows.
 */
export const chrome = async ([label = ""]: string[]): Promise<Action> =>
  update({ primaryButton: { text: label.replace("{editor}", shortName()) } }, true);

/** Icon fields for a dataview row (keys are `componentId.property` inside the cell). */
export const icon = (type: "fileicon" | "file" | "symbol", src: string) => ({
  "rowIcon.image.type": type,
  "rowIcon.image.src": src,
});

export const zedNotice = (what: string): Action =>
  status(`${what} isn’t available for ${editor().title}`, "systemOrangeColor");

/** A menu entry calling `<command> <action> <id>`. */
export const entry =
  (command: string, id: string) =>
  (text: string, action: string, hint = "") =>
    menuItem(text, [command, action, id], hint);
