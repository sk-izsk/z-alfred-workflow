import { profileCommand } from "../../../shared/ui-profile.ts";
await profileCommand(() => import("./env.ts"));
import {
  ramadan,
  ramadanForGregorian,
  ramadanText,
  ramadanSheet,
  ramadanContent,
  ramadanRows,
} from "./ramadan.ts";
import { launchInput, backVariables, performBack } from "./navigation.ts";
import { randomUUID } from "node:crypto";
import { calendar, validate, type Settings } from "./api.ts";
import { create, read, save, saveSettings, type State } from "./state.ts";
import { localDate, shiftDate, formatTime, displayed } from "./model.ts";
import { methods } from "./methods.ts";
import { components, next, run, button, label } from "../ui/window.ts";
import {
  print,
  merge,
  update,
  vars,
  status,
  errorStatus,
  popup,
  menuItem,
  copy,
  open,
  sheet,
  finish,
  type Action,
} from "./ui.ts";
const screen = (s: State): Action =>
  merge(vars({ adhan_session: s.id }), update({ root: { components: components(s) } }, true), {
    pulse: { src: "../bin/adhan", args: ["tick", s.id], interval: 30, now: false },
  });
const load = async (s: State, date = "", fresh = false): Promise<Action> => {
  const ticket = randomUUID();
  s.request = ticket;
  save(s);
  const initial = date || localDate(Date.now(), "UTC");
  let month = await calendar(s.settings, initial, fresh);
  const target = date || localDate(Date.now(), month.days[0]!.timezone);
  if (!month.days.some((d) => d.date === target)) month = await calendar(s.settings, target, fresh);
  s.date = target;
  s.month = month;
  s.nextMonth = undefined;
  const today = localDate(Date.now(), month.days[0]!.timezone);
  s.liveMonth = month.days.some((d) => d.date === today) ? month : await calendar(s.settings, today, fresh);
  // After Isha on the last day, tomorrow's Fajr belongs to the following month.
  if (!next({ ...s, month })) {
    try {
      s.nextMonth = await calendar(
        s.settings,
        shiftDate(localDate(Date.now(), month.days[0]!.timezone), 1),
        fresh,
      );
    } catch {
      /* Leave next prayer unavailable if the next month cannot be fetched. */
    }
  }
  if (read(s.id).request !== ticket) return {};
  save(s);
  return screen(s);
};
const settingsSheet = (s: State): Action =>
  sheet("settingsSheet", {
    type: "view",
    layout: "border",
    padding: 20,
    spacing: 14,
    components: [
      label("settingsTitle", "Prayer time settings", {
        font: { size: 21, weight: "semibold" },
        constraints: { region: "top" },
      }),
      {
        type: "view",
        layout: "form",
        spacing: 12,
        constraints: { region: "centre", size: { width: 620 } },
        components: [
          { type: "label", text: "City" },
          { id: "cityField", type: "textfield", text: s.settings.city },
          { type: "label", text: "Country" },
          { id: "countryField", type: "textfield", text: s.settings.country },
          { type: "label", text: "Calculation method" },
          {
            id: "methodField",
            type: "picker",
            items: methods.map(([text, value]) => ({ text, value })),
            selected: s.settings.method,
          },
          { type: "label", text: "Asr school" },
          {
            id: "schoolField",
            type: "picker",
            items: [
              { text: "Standard (Shafi / Maliki / Hanbali)", value: "0" },
              { text: "Hanafi", value: "1" },
            ],
            selected: s.settings.school,
          },
          { type: "label", text: "Clock" },
          {
            id: "clockField",
            type: "picker",
            items: [
              { text: "12-hour", value: "12" },
              { text: "24-hour", value: "24" },
            ],
            selected: s.settings.twelve ? "12" : "24",
          },
        ],
      },
      {
        type: "view",
        layout: "inline",
        direction: "vertical",
        spacing: 10,
        constraints: { region: "bottom", stretch: "horizontal" },
        components: [
          label("settingsError", "Match the method and Asr school used by your local mosque.", {
            font: { size: 11 },
            colour: "secondaryLabelColor",
            linebreak: "wordwrap",
            constraints: { size: { width: 600 } },
          }),
          button(
            "saveSettings",
            "Save and Load",
            run("save-settings", [
              "{value:cityField.text}",
              "{value:countryField.text}",
              "{value:methodField.selected.value}",
              "{value:schoolField.selected.value}",
              "{value:clockField.selected.value}",
            ]),
            { bordered: true, shortcut: "↩" },
          ),
        ],
      },
    ],
  });
const main = async (): Promise<Action | void> => {
  const [command = "", id = "", ...args] = process.argv.slice(2);
  if (command === "prepare-origin") return vars(backVariables("adhan_out", process.env.adhan_query));
  if (command === "post") {
    if (process.env.adhan_out === "back") performBack(process.env.swiss_return);
    return;
  }
  if (command === "launch") {
    const s = create(),
      query = launchInput(process.env.adhan_query).query.trim();
    if (query) {
      const parts = query.split(",");
      s.settings.city = parts.shift()!.trim();
      s.settings.country = parts.join(",").trim();
      save(s);
    }
    if (!s.settings.city || !s.settings.country)
      return merge(
        vars({ adhan_session: s.id }),
        status("Set your city, country, calculation method and Asr school."),
        settingsSheet(s),
      );
    return merge(vars({ adhan_session: s.id }), await load(s));
  }
  const s = read(id);
  if (command === "back") return finish(backVariables("adhan_out", process.env.adhan_query));
  if (command === "ramadan-back") {
    s.ramadanRequest = "";
    save(s);
    return { sheet: { close: "ramadanSheet" } };
  }
  if (command === "ramadan" || command === "copy-ramadan") {
    let year = Number(args[0] || new Date().getFullYear());
    if (!args[0]) {
      const sample = s.month?.days.find((d) => d.date === s.date) || s.month?.days[0];
      if (sample?.hijriYear) {
        const upcoming = await ramadan(s.settings, sample.hijriYear, true);
        year = Number(upcoming.days[0]!.date.slice(0, 4));
      }
    }
    const ticket = randomUUID();
    s.ramadanRequest = ticket;
    s.ramadanYear = year;
    save(s);
    const month = await ramadanForGregorian(s.settings, year, command !== "copy-ramadan"),
      latest = read(id);
    if (latest.ramadanRequest !== ticket) return {};
    latest.ramadanTable = month;
    latest.ramadanToday = localDate(Date.now(), month.days[0]!.timezone);
    save(latest);
    return command === "copy-ramadan"
      ? copy(ramadanText(s.settings, year, month))
      : args[1] === "update"
        ? { replace: { ids: { ramadanContent: ramadanContent(s.settings, year, month) } } }
        : ramadanSheet(s.settings, year, month);
  }
  if (command === "settings") return settingsSheet(s);
  if (command === "save-settings") {
    try {
      const config: Settings = validate({
        city: (args[0] || "").trim(),
        country: (args[1] || "").trim(),
        method: args[2] || "",
        school: args[3] || "",
        twelve: args[4] === "12",
      });
      s.settings = config;
      saveSettings(config);
      save(s);
      const result = await load(s);
      return merge({ sheet: { close: "settingsSheet" } }, result);
    } catch (error) {
      return update(
        {
          settingsError: {
            text: error instanceof Error ? error.message : String(error),
            colour: "systemRedColor",
          },
        },
        true,
      );
    }
  }
  if (command === "tick") {
    if (!s.month) return {};
    const timezone = s.month.days[0]!.timezone,
      today = localDate(Date.now(), timezone);
    if (!next(s) || !(s.liveMonth || s.month).days.some((d) => d.date === today)) return load(s);
    const action = screen(s);
    if (
      s.ramadanTable &&
      s.ramadanRequest &&
      s.ramadanToday !== localDate(Date.now(), s.ramadanTable.days[0]!.timezone)
    ) {
      s.ramadanToday = localDate(Date.now(), s.ramadanTable.days[0]!.timezone);
      save(s);
      return merge(
        action,
        update({
          ramadanDays: {
            data: { src: ramadanRows(s.settings, s.ramadanTable) },
            select: s.ramadanTable.days.some((d) => d.date === s.ramadanToday) ? s.ramadanToday : "",
          },
        }),
      );
    }
    return action;
  }
  if (command === "today" || command === "refresh")
    return load(s, command === "refresh" ? s.date : "", command === "refresh");
  if (command === "date") {
    const delta = Number(args[0]);
    if (![-1, 1].includes(delta) || !s.date) return {};
    return load(s, shiftDate(s.date, delta));
  }
  if (command === "menu")
    return popup("actionsButton", [
      menuItem("Ramadan Timetable", ["ramadan", id]),
      menuItem("Today", ["today", id]),
      menuItem("Previous Day", ["date", id, "-1"], "←"),
      menuItem("Next Day", ["date", id, "1"], "→"),
      menuItem("Copy Daily Prayer Times", ["copy", id]),
      menuItem("Calculation Details", ["details", id]),
      menuItem("Settings…", ["settings", id]),
      menuItem("Refresh Calendar", ["refresh", id], "⌘R"),
      menuItem("Open Aladhan", ["website", id]),
    ]);
  if (command === "website") return open("https://aladhan.com/prayer-times-api");
  const day = s.month?.days.find((d) => d.date === s.date);
  if (!day) throw new Error("Load a prayer calendar first.");
  if (command === "copy")
    return copy(
      `${s.settings.city}, ${s.settings.country} · ${s.date}\n${day.hijri}\n${displayed.map((name) => `${name}: ${formatTime(day.times[name]!, s.settings.twelve)}`).join("\n")}\n${day.timezone}\n${day.method} · ${day.school} Asr\nSource: Aladhan${s.month?.stale ? " · cached after failed refresh" : ""}`,
    );
  if (command === "details")
    return sheet("detailsSheet", {
      type: "view",
      layout: "border",
      padding: 20,
      components: [
        label(
          "calculationDetails",
          `${s.settings.city}, ${s.settings.country}\n\n${day.method}\n${day.school} Asr\nTimezone: ${day.timezone}\nCalendar fetched: ${new Date(s.month!.fetched).toISOString()}${s.month?.stale ? "\nCached after failed refresh" : ""}\n\nSunrise is shown for reference; it is not included in the next-prayer countdown.\nCalculated times may differ from your mosque's timetable. Confirm the method and school locally.\n\nSource: Aladhan. No automatic audio, notifications or background service.`,
          {
            font: { size: 14 },
            linebreak: "wordwrap",
            constraints: { region: "centre", size: { width: 620, height: 340 } },
          },
        ),
      ],
    });
  throw new Error("Unknown Adhan command.");
};
try {
  const result = await main();
  if (result) print(result);
} catch (error) {
  print(errorStatus(error));
}
