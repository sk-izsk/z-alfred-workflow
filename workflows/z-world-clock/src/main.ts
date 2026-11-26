import { profileCommand } from "../../../shared/ui-profile.ts";
await profileCommand(() => import("./env.ts"));
import { randomUUID } from "node:crypto";
import {
  create,
  read,
  save,
  entry,
  editStar,
  duplicate,
  savePreferences,
  avatarPath,
  type State,
} from "./state.ts";
import { clock, canonical, type Entry } from "./model.ts";
import { rows } from "./presentation.ts";
import { face } from "./face.ts";
import { components, run, label, button } from "../ui/window.ts";
import {
  print,
  merge,
  update,
  vars,
  errorStatus,
  popup,
  menuItem,
  copy,
  finish,
  sheet,
  type Action,
} from "./ui.ts";
import { launchInput, backVariables, performBack } from "./navigation.ts";
const populate = (s: State): Action => {
  const data = rows(s),
    selected = data.some((e) => e.uid === s.selected) ? s.selected : String(data[0]?.uid || "");
  return update(
    {
      items: { data: { src: data }, select: selected },
      sectionTitle: {
        text: `${s.prefs.stars.length} starred · ${data.length} matching timezones · ${s.prefs.layout === "grid" ? "Analog grid" : "World time"}`,
      },
    },
    true,
  );
};
const screen = (s: State): Action =>
  merge(vars({ clock_session: s.id }), update({ root: { components: components(s) } }, true), {
    pulse: { src: "../bin/wclock", args: ["populate", s.id], interval: 0, now: true },
  });
const tickPulse = (s: State): Action => ({
  pulse: { src: "../bin/wclock", args: ["tick", s.id], interval: 10, now: false },
});
const info = (s: State, e: Entry) => ({
  ...clock(e.zone, Date.now(), s.prefs.hour24, s.prefs.dateFormat),
  alias: e.alias,
  memo: e.memo,
  localTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
});
const details = (s: State, e: Entry): Action => {
  const c = info(s, e);
  return sheet("detailSheet", {
    type: "view",
    layout: "border",
    padding: 22,
    spacing: 18,
    components: [
      label("detailTitle", e.alias || e.zone, {
        font: { size: 23, weight: "medium" },
        linebreak: "truncatetail",
        constraints: { region: "top", size: { width: 620 } },
      }),
      {
        type: "view",
        layout: "border",
        spacing: 22,
        constraints: { region: "centre", size: { width: 640, height: 290 } },
        components: [
          {
            type: "imageview",
            image: { type: "file", src: face(c.hour, c.minute) },
            constraints: { region: "left", position: "centre", size: { width: 170, height: 170 } },
          },
          label(
            "detailInfo",
            `${c.time}\n${c.date}\n\n${e.zone}\n${c.utc} · ${c.difference}\nRelative to ${c.localTimezone}\n${c.day ? "Daytime hours (06:00–17:59)" : "Nighttime hours (18:00–05:59)"}${e.memo ? "\n\n" + e.memo : ""}`,
            {
              font: { size: 16 },
              selectable: true,
              linebreak: "wordwrap",
              constraints: { region: "centre", position: "centre", stretch: "horizontal" },
            },
          ),
        ],
      },
      label("detailNote", "Current snapshot · daylight indicator uses clock hours, not sunrise/sunset", {
        font: { size: 11 },
        colour: "secondaryLabelColor",
        constraints: { region: "bottom" },
      }),
    ],
  });
};
const edit = (s: State, e: Entry): Action =>
  sheet("editSheet", {
    type: "view",
    layout: "border",
    padding: 22,
    spacing: 15,
    components: [
      label("editTitle", `Edit ${e.zone}`, {
        font: { size: 20, weight: "medium" },
        constraints: { region: "top" },
      }),
      {
        type: "view",
        layout: "form",
        spacing: 12,
        constraints: { region: "centre", size: { width: 620 } },
        components: [
          { type: "label", text: "Alias" },
          { id: "aliasField", type: "textfield", text: e.alias, focus: true },
          { type: "label", text: "Memo icon / emoji" },
          { id: "emojiField", type: "textfield", text: e.emoji },
          { type: "label", text: "Avatar image path" },
          { id: "avatarField", type: "textfield", text: e.avatar, placeholder: "Optional path to an image" },
          { type: "label", text: "Memo" },
          { id: "memoField", type: "textarea", text: e.memo, constraints: { size: { height: 90 } } },
        ],
      },
      {
        type: "view",
        layout: "inline",
        direction: "vertical",
        spacing: 10,
        constraints: { region: "bottom", stretch: "horizontal" },
        components: [
          label("editError", "Avatar paths stay local. Clear the path to use the clock icon.", {
            font: { size: 11 },
            colour: "secondaryLabelColor",
          }),
          button(
            "saveEdit",
            "Save Timezone",
            run("save-edit", [
              e.id,
              "{value:aliasField.text}",
              "{value:emojiField.text}",
              "{value:avatarField.text}",
              "{value:memoField.text}",
            ]),
            { bordered: true, shortcut: "↩" },
          ),
        ],
      },
    ],
  });
const settings = (s: State): Action =>
  sheet("settingsSheet", {
    type: "view",
    layout: "border",
    padding: 22,
    spacing: 15,
    components: [
      label("settingsTitle", "World Clock preferences", {
        font: { size: 22, weight: "medium" },
        constraints: { region: "top" },
      }),
      {
        type: "view",
        layout: "form",
        spacing: 13,
        constraints: { region: "centre", size: { width: 560 } },
        components: [
          { type: "label", text: "Clock" },
          {
            id: "formatField",
            type: "picker",
            items: [
              { text: "24-hour", value: "24" },
              { text: "12-hour", value: "12" },
            ],
            selected: s.prefs.hour24 ? "24" : "12",
          },
          { type: "label", text: "Date format" },
          {
            id: "dateField",
            type: "picker",
            items: [
              { text: "YYYY-MM-DD", value: "iso" },
              { text: "MM/DD/YYYY", value: "us" },
              { text: "DD/MM/YYYY", value: "eu" },
            ],
            selected: s.prefs.dateFormat,
          },
          { type: "label", text: "Grid columns" },
          {
            id: "columnsField",
            type: "picker",
            items: [3, 4, 5, 6].map((n) => ({ text: String(n), value: String(n) })),
            selected: String(s.prefs.columns),
          },
        ],
      },
      button(
        "saveSettings",
        "Save Preferences",
        run("save-settings", [
          "{value:formatField.selected.value}",
          "{value:dateField.selected.value}",
          "{value:columnsField.selected.value}",
        ]),
        { bordered: true, shortcut: "↩", constraints: { region: "bottom", position: "right" } },
      ),
    ],
  });
const main = async (): Promise<Action | void> => {
  const [command = "", id = "", ...args] = process.argv.slice(2);
  if (command === "prepare-origin") return vars(backVariables("clock_out", process.env.clock_query));
  if (command === "post") {
    if (process.env.clock_out === "back") performBack(process.env.swiss_return);
    return;
  }
  if (command === "launch") return screen(create(launchInput(process.env.clock_query).query));
  const s = read(id),
    chosen = args[0] || s.selected;
  if (command === "back") return finish(backVariables("clock_out", process.env.clock_query));
  if (command === "populate") return merge(populate(s), tickPulse(s));
  if (command === "tick") {
    const minute = Math.floor(Date.now() / 60000);
    if (minute === s.minute) return {};
    s.minute = minute;
    save(s);
    return populate(s);
  }
  if (command === "query") {
    s.query = (args[0] || "").slice(0, 200);
    save(s);
    return populate(s);
  }
  if (command === "select") {
    s.selected = chosen;
    save(s);
    return {};
  }
  if (command === "refresh") return populate(s);
  if (command === "filter") {
    if (
      ![
        "all",
        "starred",
        "other",
        "Africa",
        "America",
        "Antarctica",
        "Asia",
        "Atlantic",
        "Australia",
        "Europe",
        "Indian",
        "Pacific",
      ].includes(args[0] || "")
    )
      throw new Error("Choose a valid region filter.");
    s.prefs.filter = args[0]!;
    savePreferences(s.prefs);
    save(s);
    return populate(s);
  }
  if (command === "layout") {
    s.prefs.layout = s.prefs.layout === "grid" ? "list" : "grid";
    savePreferences(s.prefs);
    save(s);
    return screen(s);
  }
  if (command === "settings") return settings(s);
  if (command === "save-settings") {
    if (
      !["12", "24"].includes(args[0] || "") ||
      !["iso", "us", "eu"].includes(args[1] || "") ||
      !["3", "4", "5", "6"].includes(args[2] || "")
    )
      throw new Error("Choose valid clock preferences.");
    s.prefs.hour24 = args[0] === "24";
    s.prefs.dateFormat = args[1]!;
    s.prefs.columns = Number(args[2]);
    savePreferences(s.prefs);
    save(s);
    return merge({ sheet: { close: "settingsSheet" } }, screen(s));
  }
  if (command === "menu" && args.length > 0 && !args[0])
    return popup("actionsButton", [
      menuItem(
        s.prefs.layout === "grid" ? "Switch to List View" : "Switch to Grid View",
        ["layout", id],
        "⌘L",
      ),
      menuItem("World Clock Preferences…", ["settings", id]),
      menuItem("Refresh Times", ["refresh", id], "⌘R"),
    ]);
  const e = entry(s, chosen),
    starIndex = s.prefs.stars.findIndex((v) => v.id === e.id);
  if (command === "copy") {
    const c = info(s, e);
    return copy(`${e.alias || e.zone}: ${c.date} ${c.time} (${c.utc})`);
  }
  if (command === "copy-all") return copy(JSON.stringify(info(s, e), null, 2));
  if (command === "details") return details(s, e);
  if (command === "edit") return edit(s, e);
  if (command === "save-edit") {
    try {
      if ((args[1] || "").length > 100 || (args[2] || "").length > 12 || (args[4] || "").length > 1000)
        throw new Error("Keep aliases under 100 characters and memos under 1000.");
      editStar(s, e.id, {
        alias: (args[1] || "").trim(),
        emoji: (args[2] || "").trim(),
        avatar: avatarPath(args[3] || ""),
        memo: (args[4] || "").trim(),
      });
      return merge({ sheet: { close: "editSheet" } }, populate(s));
    } catch (error) {
      return update(
        {
          editError: {
            text: error instanceof Error ? error.message : "Could not save timezone.",
            colour: "systemRedColor",
          },
        },
        true,
      );
    }
  }
  if (command === "duplicate") {
    duplicate(s, e.id);
    return populate(s);
  }
  if (command === "star") {
    if (starIndex >= 0) s.prefs.stars.splice(starIndex, 1);
    else {
      s.prefs.stars.push({ ...e, id: randomUUID(), zone: canonical(e.zone) });
      s.selected = s.prefs.stars.at(-1)!.id;
    }
    savePreferences(s.prefs);
    save(s);
    return populate(s);
  }
  if (command === "move") {
    const delta = Number(args[1]),
      to = starIndex + delta;
    if (![-1, 1].includes(delta) || starIndex < 0 || to < 0 || to >= s.prefs.stars.length) return {};
    const [item] = s.prefs.stars.splice(starIndex, 1);
    s.prefs.stars.splice(to, 0, item!);
    savePreferences(s.prefs);
    save(s);
    return populate(s);
  }
  if (command === "menu")
    return popup("actionsButton", [
      menuItem("Copy Time", ["copy", id, e.id], "↩"),
      menuItem("Copy All Info", ["copy-all", id, e.id]),
      menuItem("Show Timezone Details", ["details", id, e.id]),
      menuItem(starIndex >= 0 ? "Unstar Timezone" : "Star Timezone", ["star", id, e.id]),
      ...(starIndex >= 0
        ? [
            menuItem("Edit Timezone…", ["edit", id, e.id]),
            menuItem("Duplicate Timezone", ["duplicate", id, e.id]),
            ...(starIndex > 0 ? [menuItem("Move Up", ["move", id, e.id, "-1"])] : []),
            ...(starIndex < s.prefs.stars.length - 1 ? [menuItem("Move Down", ["move", id, e.id, "1"])] : []),
          ]
        : []),
      menuItem(
        s.prefs.layout === "grid" ? "Switch to List View" : "Switch to Grid View",
        ["layout", id],
        "⌘L",
      ),
      menuItem("World Clock Preferences…", ["settings", id]),
      menuItem("Refresh Times", ["refresh", id], "⌘R"),
    ]);

  throw new Error("Unknown World Clock command.");
};
try {
  const result = await main();
  if (result) print(result);
} catch (error) {
  print(errorStatus(error));
}
