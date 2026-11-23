import { editor, shortName } from "../editors.ts";
import { type LocalExtension, extensionUri, localExtensions, uninstallExtension } from "../extensions.ts";
import { openUrl, revealInFinder } from "../launch.ts";
import { itemUrl } from "../marketplace.ts";
import { type Action, copy, finish, merge, popup, rows, separator, status } from "../ui.ts";
import { entry, icon, zedNotice } from "./common.ts";

export const toRow = (e: LocalExtension) => ({
  uid: e.id,
  ...(e.icon ? icon("file", e.icon) : icon("symbol", "puzzlepiece.extension")),
  "rowTitle.text": e.name,
  "rowDetail.text": e.publisher,
  "rowVersion.text": e.version,
  "rowPreRelease.hidden": !e.preRelease,
  match: [e.name, e.publisher, e.id].join(" "),
});

const load = (note?: string): Action => {
  const list = localExtensions();
  return merge(rows("items", list.map(toRow)), status(note ?? `${list.length} installed extensions`));
};

export const extInit = async (): Promise<Action> =>
  editor().kind === "zed" ? zedNotice("Extensions") : load();

/** Confirm with a second menu: a native "are you sure?" without a modal sheet. */
export const confirmUninstall = (command: string, id: string, name: string): Action =>
  popup("actionsButton", [
    entry(command, id)(`Uninstall ${name}`, "uninstall-yes"),
    separator,
    { text: "Cancel", action: { type: "json", src: {} } },
  ]);

export const ext = async ([action = "", id = ""]: string[]): Promise<Action> => {
  const e = localExtensions().find((x) => x.id === id);
  if (!e) throw new Error("Select an extension first");
  const item = entry("ext", id);
  switch (action) {
    case "open":
      await openUrl(extensionUri(id));
      return finish();
    case "browser":
      await openUrl(itemUrl(id));
      return finish();
    case "reveal":
      await revealInFinder(e.path);
      return finish();
    case "copy-id":
      return merge(copy(id), status(`Copied ${id}`));
    case "uninstall":
      return confirmUninstall("ext", id, e.name);
    case "uninstall-yes":
      await uninstallExtension(id);
      return load(`Uninstalled ${e.name}`);
    case "menu":
      return popup("actionsButton", [
        item(`Open in ${shortName()}`, "open", "↩"),
        item("Open in Browser", "browser", "⇧⌘O"),
        item("Show in Finder", "reveal", "⇧⌘F"),
        separator,
        item("Copy Extension ID", "copy-id", "⇧⌘C"),
        separator,
        item("Uninstall Extension…", "uninstall"),
      ]);
    default:
      throw new Error(`Unknown action: ${action}`);
  }
};
