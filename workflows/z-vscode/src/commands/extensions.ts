import { pathToFileURL } from "node:url";
import { editor, shortName } from "../editors.ts";
import { type LocalExtension, extensionUri, localExtensions, uninstallExtension } from "../extensions.ts";
import { openUrl, revealInFinder } from "../launch.ts";
import { itemUrl } from "../marketplace.ts";
import { localReadme, type Preview, previewMarkdown } from "../preview.ts";
import { type Profile, configuredProfile } from "../profiles.ts";
import {
  type Action,
  copy,
  finish,
  merge,
  popup,
  rows,
  separator,
  sheet,
  script,
  status,
  update,
  vars,
} from "../ui.ts";
import { entry, icon, zedNotice } from "./common.ts";

export const EXT_KINDS = [
  { text: "All Extensions", value: "all" },
  { text: "Themes", value: "themes" },
  { text: "Other", value: "other" },
];
const validKind = (k = "") => (EXT_KINDS.some((x) => x.value === k) ? k : "all");

export const toRow = (e: LocalExtension) => ({
  uid: e.id,
  ...(e.icon ? icon("file", e.icon) : icon("symbol", "puzzlepiece.extension")),
  "rowTitle.text": e.name,
  "rowDetail.text": e.publisher,
  "rowVersion.text": e.version,
  "rowPreRelease.hidden": !e.preRelease,
  "rowTheme.hidden": !e.isTheme,
  match: [e.name, e.publisher, e.id].join(" "),
});

const load = (profile: Profile, kind: string, note?: string): Action => {
  const list = localExtensions(profile.manifestPath).filter(
    (e) => kind === "all" || (kind === "themes" ? e.isTheme : !e.isTheme),
  );
  return merge(
    rows("items", list.map(toRow)),
    status(note ?? `${list.length} extensions in ${profile.name}`),
  );
};

export const extInit = async (): Promise<Action> => {
  if (editor().kind === "zed") return zedNotice("Extensions");
  const kind = validKind(process.env.ext_kind);
  return merge(vars({ ext_kind: kind }), load(await configuredProfile(), kind));
};

/** Picker choices, sent on their own (a bad picker update must never empty the list). */
export const extPickers = async (): Promise<Action> =>
  editor().kind === "zed"
    ? {}
    : update({ kindPicker: { items: EXT_KINDS, selected: validKind(process.env.ext_kind) } });

export const extFilter = async ([kind = "all"]: string[]): Promise<Action> =>
  merge(vars({ ext_kind: validKind(kind) }), load(await configuredProfile(), validKind(kind)));

/** README + screenshots in a large sheet over the list, as native Markdown (see preview.ts). */
const closeSheet = { type: "json", src: { sheet: { close: "previewSheet" } } };

/**
 * `primary`: what ↩ does in the preview (Install, or Open in Code). It's a script action that runs
 * after the sheet closes, so its result (status, rows) lands in the window underneath.
 */
export const previewSheet = (
  preview: Preview,
  title: string,
  url: string,
  primary: { text: string; args: string[] },
): Action =>
  sheet(
    "previewSheet",
    {
      type: "view",
      layout: "border",
      components: [
        {
          // Padding keeps the README off the sheet's edges; the icon sits beside it at 56 pt.
          type: "view",
          layout: "border",
          padding: 22,
          spacing: 16,
          constraints: { region: "centre" },
          components: [
            ...(preview.icon
              ? [
                  {
                    id: "previewIcon",
                    type: "imageview",
                    image: { type: "file", src: preview.icon },
                    cornerradius: 10,
                    constraints: { region: "left", position: "top", size: { width: 56, height: 56 } },
                  },
                ]
              : []),
            {
              id: "previewText",
              type: "markdownarea",
              text: preview.markdown,
              paragraphspacing: 6,
              // Transparent, so the 22 pt padding around it shows as space around the text.
              background: null,
              constraints: { region: "centre", size: { width: preview.icon ? 620 : 692, height: 480 } },
            },
          ],
        },
        {
          type: "label",
          text: title,
          colour: "secondaryLabelColor",
          linebreak: "truncatetail",
          // Inset like the README above, so the caption doesn't sit on the sheet's edge.
          constraints: { region: "bottom", insets: { left: 22, right: 22, bottom: 4 } },
        },
      ],
    },
    true,
    undefined,
    [
      {
        type: "button",
        text: "Open in Browser",
        bordered: false,
        events: [
          { triggers: "actioned", action: { type: "json", src: { open: { type: "url", src: url } } } },
        ],
      },
      {
        type: "button",
        text: `${primary.text}  ↩`,
        bordered: false,
        shortcut: "↩",
        events: [{ triggers: "actioned", action: [closeSheet, script(primary.args, true)] }],
      },
    ],
  );

/** Confirm with a second menu: a native "are you sure?" without a modal sheet. */
export const confirmUninstall = (command: string, id: string, name: string, where = ""): Action =>
  popup("actionsButton", [
    entry(command, id)(`Uninstall ${name}${where ? ` from ${where}` : ""}`, "uninstall-yes"),
    separator,
    { text: "Cancel", action: { type: "json", src: {} } },
  ]);

export const ext = async ([action = "", id = ""]: string[]): Promise<Action> => {
  const profile = await configuredProfile();
  const e = localExtensions(profile.manifestPath).find((x) => x.id === id);
  if (!e) throw new Error("Select an extension first");
  const item = entry("ext", id);
  const kind = validKind(process.env.ext_kind);
  switch (action) {
    case "open":
      await openUrl(extensionUri(id));
      return finish();
    case "browser":
      await openUrl(itemUrl(id));
      return finish();
    case "preview":
      return previewSheet(
        await previewMarkdown({
          name: e.name,
          publisher: e.publisher,
          description: (e.pkg as { description?: string }).description ?? "",
          version: e.version,
          icon: e.icon ?? "",
          readme: localReadme(e.path),
          base: pathToFileURL(`${e.path}/`).href,
        }),
        e.name,
        itemUrl(id),
        { text: `Open in ${shortName()}`, args: ["ext", "open", id] },
      );
    case "reveal":
      await revealInFinder(e.path);
      return finish();
    case "copy-id":
      return merge(copy(id), status(`Copied ${id}`));
    case "uninstall":
      return confirmUninstall("ext", id, e.name, profile.name);
    case "uninstall-yes":
      await uninstallExtension(id, profile.name);
      return load(profile, kind, `Uninstalled ${e.name} from ${profile.name}`);
    case "menu":
      return popup("actionsButton", [
        item(`Open in ${shortName()}`, "open", "↩"),
        item("Preview", "preview", "⌘Y"),
        item("Open in Browser", "browser", "⇧⌘O"),
        item("Show in Finder", "reveal", "⇧⌘F"),
        separator,
        item("Copy Extension ID", "copy-id", "⇧⌘C"),
        separator,
        item(`Uninstall from ${profile.name}…`, "uninstall"),
      ]);
    default:
      throw new Error(`Unknown action: ${action}`);
  }
};
