import { displayed, formatTime, localDate, nextPrayer, countdown } from "../src/model.ts";
import type { State } from "../src/state.ts";
export type Json = Record<string, any>;
export const run = (command: string, args: string[] = [], async = true): Json => ({
  type: "script",
  src: "../bin/adhan",
  args: [command, "{var:adhan_session}", ...args],
  async,
});
export const label = (id: string, text: string, extra: Json = {}): Json => ({
  id,
  type: "label",
  text,
  ...extra,
});
export const button = (id: string, text: string, action: Json, extra: Json = {}): Json => ({
  id,
  type: "button",
  text,
  bordered: false,
  events: [{ triggers: "actioned", action }],
  ...extra,
});
const symbol = (id: string, src: string, colour: string, size = 26): Json => ({
  id,
  type: "imageview",
  image: { type: "symbol", src, size: { width: size, height: size } },
  contenttintcolour: colour,
  constraints: { size: { width: size, height: size } },
});
export const next = (s: State, now = Date.now()) => {
  const days = [...((s.liveMonth || s.month)?.days || []), ...(s.nextMonth?.days || [])],
    timezone = days[0]?.timezone;
  return nextPrayer(
    days.filter((d) => timezone && d.date >= localDate(now, timezone)),
    now,
  );
};
export const components = (s: State): Json[] => {
  const day = s.month?.days.find((d) => d.date === s.date),
    upcoming = next(s),
    nextTime = upcoming ? formatTime(upcoming.day.times[upcoming.name]!, s.settings.twelve) : "—";
  return [
    {
      type: "view",
      layout: "border",
      padding: 18,
      spacing: 14,
      constraints: { region: "top" },
      components: [
        label("title", `${s.settings.city}, ${s.settings.country}`, {
          font: { size: 21, weight: "semibold" },
          linebreak: "truncatetail",
          constraints: { region: "centre" },
        }),
        {
          type: "view",
          layout: "inline",
          spacing: 10,
          constraints: { region: "right" },
          components: [
            button("previous", "‹", run("date", ["-1"])),
            button("today", "Today", run("today")),
            button("following", "›", run("date", ["1"])),
          ],
        },
      ],
    },
    {
      type: "view",
      layout: "grid",
      rows: 1,
      cols: 2,
      padding: 20,
      spacing: 24,
      constraints: { region: "centre" },
      components: [
        {
          type: "view",
          layout: "inline",
          direction: "vertical",
          spacing: 15,
          constraints: { position: "centre" },
          components: [
            symbol("moon", "moon.stars.fill", "systemTealColor", 76),
            label("nextCaption", "NEXT PRAYER", {
              font: { size: 11, weight: "semibold" },
              colour: "secondaryLabelColor",
            }),
            label("nextName", upcoming?.name || "Unavailable", { font: { size: 33, weight: "medium" } }),
            label("nextTime", nextTime, { font: { size: 46, weight: "light" } }),
            label(
              "remaining",
              upcoming ? `In ${countdown(upcoming.at)}` : "Next prayer could not be calculated",
              { font: { size: 17 }, colour: "systemTealColor" },
            ),
            label("nextDate", upcoming?.day.date || "", {
              font: { size: 12 },
              colour: "secondaryLabelColor",
            }),
            label("zone", day?.timezone || "", { font: { size: 12 }, colour: "secondaryLabelColor" }),
          ],
        },
        {
          type: "view",
          layout: "border",
          spacing: 12,
          components: [
            {
              type: "view",
              layout: "inline",
              direction: "vertical",
              spacing: 5,
              constraints: { region: "top", position: "left" },
              components: [
                label("date", s.date, { font: { size: 20, weight: "semibold" } }),
                label("hijri", day?.hijri || "", { font: { size: 12 }, colour: "secondaryLabelColor" }),
              ],
            },
            {
              type: "view",
              layout: "inline",
              direction: "vertical",
              spacing: 7,
              constraints: { region: "centre", position: "top", stretch: "horizontal" },
              components: displayed.map((name, i) => ({
                type: "view",
                layout: "border",
                padding: 10,
                spacing: 12,
                cornerradius: 8,
                border:
                  upcoming?.name === name && upcoming.day.date === s.date
                    ? { width: 1, colour: "systemTealColor" }
                    : undefined,
                constraints: { stretch: "horizontal", size: { height: 46 } },
                components: [
                  {
                    ...symbol(
                      `prayerIcon${i}`,
                      [
                        "sun.haze.fill",
                        "sunrise.fill",
                        "sun.max.fill",
                        "sun.haze.fill",
                        "sunset.fill",
                        "moon.fill",
                      ][i]!,
                      i === 5 ? "systemPurpleColor" : "systemOrangeColor",
                      24,
                    ),
                    constraints: { region: "left", position: "centre", size: { width: 24, height: 24 } },
                  },
                  label(`prayer${i}`, name, {
                    font: { size: 16, weight: "medium" },
                    constraints: { region: "centre", position: "left", stretch: "horizontal" },
                  }),
                  label(`time${i}`, formatTime(day?.times[name] || "—", s.settings.twelve), {
                    font: { size: 16 },
                    constraints: { region: "right", position: "centre" },
                  }),
                ],
              })),
            },
            label("method", `${day?.method || ""}\n${day?.school || ""} Asr · City-local times`, {
              font: { size: 11 },
              colour: "secondaryLabelColor",
              linebreak: "wordwrap",
              constraints: { region: "bottom", size: { width: 370 } },
            }),
          ],
        },
      ],
    },
    {
      type: "view",
      layout: "border",
      padding: 15,
      spacing: 12,
      constraints: { region: "bottom" },
      components: [
        label(
          "statusLabel",
          s.month?.stale || s.nextMonth?.stale
            ? "Cached calendar · refresh failed"
            : "Aladhan · calculated prayer times",
          {
            font: { size: 11 },
            colour: s.month?.stale ? "systemOrangeColor" : "secondaryLabelColor",
            linebreak: "truncatetail",
            constraints: { region: "centre", stretch: "horizontal" },
          },
        ),
        {
          type: "view",
          layout: "inline",
          spacing: 12,
          constraints: { region: "right" },
          components: [
            button("back", "Back  {var:back_shortcut}", run("back", [], false), {
              shortcut: "{var:back_shortcut}",
            }),
            button("settings", "Settings", run("settings")),
            button("actionsButton", "Actions  {var:actions_shortcut}", run("menu")),
          ],
        },
      ],
    },
  ];
};
export const adhanWindow = {
  bundleid: "com.izsk.adhan-time",
  variablesconfig: {
    swiss_return: { default: "" },
    adhan_session: { default: "", scriptenv: true },
    adhan_query: { src: "args[0]", default: "", scriptenv: true },
    back_shortcut: { src: "variable", default: "⌘[" },
    actions_shortcut: { src: "variable", default: "⌘K" },
  },
  window: {
    title: "Adhan Time",
    size: { width: 900, height: 600 },
    minsize: { width: 850, height: 600 },
    root: {
      id: "root",
      type: "view",
      layout: "border",
      events: [{ triggers: "launched", action: [run("prepare-origin", [], false), run("launch")] }],
      shortcuts: [
        { shortcut: "{var:actions_shortcut}", action: run("menu") },
        { shortcut: "←", action: run("date", ["-1"]) },
        { shortcut: "→", action: run("date", ["1"]) },
        { shortcut: "⌘R", action: run("refresh") },
      ],
      components: [
        label("statusLabel", "Loading prayer times…", {
          constraints: { region: "centre", position: "centre" },
        }),
        button(
          "initialBack",
          "Back  {var:back_shortcut}",
          {
            type: "json",
            src: { finish: { variables: { adhan_out: "back", swiss_return: "{var:swiss_return}" } } },
          },
          {
            shortcut: "{var:back_shortcut}",
            constraints: { region: "bottom", position: "left", insets: { left: 16, bottom: 16 } },
          },
        ),
      ],
    },
  },
};
