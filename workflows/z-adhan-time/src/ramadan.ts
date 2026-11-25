import { createHash } from "node:crypto";
import { join } from "node:path";
import { cacheDir, cacheMinutes, readJson, writeJson } from "./env.ts";
import { parseMonth, formatTime, type Day } from "./model.ts";
import { validate, type Settings, type Month } from "./api.ts";
import { sheet, type Action } from "./ui.ts";
import { label, button, run } from "../ui/window.ts";
export const parseRamadan = (raw: unknown, year: number): Day[] => {
  const days = parseMonth(raw);
  if (
    ![29, 30].includes(days.length) ||
    days.some((d, i) => d.hijriYear !== year || d.hijriMonth !== 9 || d.hijriDay !== i + 1)
  )
    throw new Error("Provider did not return a complete Ramadan calendar for that year.");
  return days;
};
export const ramadan = async (settings: Settings, year: number, fresh = false): Promise<Month> => {
  validate(settings);
  if (!Number.isInteger(year) || year < 1300 || year > 1600)
    throw new Error("Choose a Hijri year between 1300 and 1600.");
  const key = createHash("sha256")
      .update(JSON.stringify([settings.city, settings.country, settings.method, settings.school, year]))
      .digest("hex")
      .slice(0, 24),
    path = join(cacheDir(), `ramadan-${key}.json`),
    old = readJson<Month | null>(path, null);
  if (old && !fresh && Date.now() - old.fetched < cacheMinutes("cache_minutes", 1440) * 60000) return old;
  try {
    const url = new URL(`https://api.aladhan.com/v1/hijriCalendarByCity/${year}/9`);
    url.search = new URLSearchParams({
      city: settings.city,
      country: settings.country,
      method: settings.method,
      school: settings.school,
    }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Ramadan calendar HTTP ${response.status}.`);
    const text = await response.text();
    if (text.length > 2e6) throw new Error("Calendar too large.");
    const value = { days: parseRamadan(JSON.parse(text), year), fetched: Date.now(), stale: false };
    writeJson(path, value);
    return value;
  } catch (error) {
    if (old) return { ...old, stale: true };
    throw error;
  }
};
export const ramadanText = (settings: Settings, year: number, month: Month): string =>
  `Ramadan ${year} AH · ${settings.city}, ${settings.country}\nDay\tDate\tImsak (provider)\tFajr (fast begins)\tMaghrib (Iftar)\n${month.days.map((d) => `${d.hijriDay}\t${d.date}\t${formatTime(d.times.Imsak || "—", settings.twelve)}\t${formatTime(d.times.Fajr || "—", settings.twelve)}\t${formatTime(d.times.Maghrib || "—", settings.twelve)}`).join("\n")}\n${month.days[0]!.method} · ${month.days[0]!.school} Asr · ${month.days[0]!.timezone}\nCalculated by Aladhan · Fetched ${new Date(month.fetched).toISOString()}${month.stale ? " · Cached after failed refresh" : ""}\nImsak is the provider's precautionary time; confirm your local mosque's timetable.`;
export const ramadanContent = (settings: Settings, year: number, month: Month): Action => ({
  id: "ramadanContent",
  type: "view",
  layout: "border",
  padding: 18,
  spacing: 12,
  components: [
    {
      type: "view",
      layout: "border",
      spacing: 12,
      constraints: { region: "top" },
      components: [
        label("ramadanTitle", `Ramadan ${year} AH · ${settings.city}`, {
          font: { size: 20, weight: "semibold" },
          constraints: { region: "centre" },
        }),
        {
          id: "ramadanYearPicker",
          type: "picker",
          items: Array.from({ length: 5 }, (_, i) => ({
            text: `${year + i - 2} AH`,
            value: String(year + i - 2),
          })),
          selected: String(year),
          constraints: { region: "right", size: { width: 115 } },
          events: [
            { triggers: "changed", action: run("ramadan", ["{value:self.selected.value}", "update"]) },
          ],
        },
      ],
    },
    {
      type: "view",
      layout: "border",
      constraints: { region: "centre", size: { width: 820, height: 440 } },
      components: [
        {
          type: "view",
          layout: "grid",
          rows: 1,
          cols: 4,
          padding: 6,
          spacing: 10,
          constraints: { region: "top" },
          components: ["Day / Gregorian date", "Imsak", "Fajr", "Iftar"].map((text, i) =>
            label(`ramadanColumn${i}`, text, {
              font: { size: 12, weight: "semibold" },
              colour: "secondaryLabelColor",
              textalign: i === 0 ? "left" : "centre",
            }),
          ),
        },
        {
          type: "dataview",
          data: {
            type: "basic",
            src: month.days.map((d) => ({
              uid: d.date,
              "ramadanDate.text": `${String(d.hijriDay).padStart(2, "0")} · ${d.date}`,
              "ramadanImsak.text": formatTime(d.times.Imsak || "—", settings.twelve),
              "ramadanFajr.text": formatTime(d.times.Fajr || "—", settings.twelve),
              "ramadanIftar.text": formatTime(d.times.Maghrib || "—", settings.twelve),
            })),
          },
          constraints: { region: "centre" },
          cell: {
            height: 39,
            root: {
              type: "view",
              layout: "grid",
              rows: 1,
              cols: 4,
              padding: 6,
              spacing: 10,
              components: [
                label("ramadanDate", "", { font: { size: 13 } }),
                label("ramadanImsak", "", { font: { size: 13 }, textalign: "centre" }),
                label("ramadanFajr", "", { font: { size: 13 }, textalign: "centre" }),
                label("ramadanIftar", "", {
                  font: { size: 13, weight: "medium" },
                  textalign: "centre",
                  colour: "systemTealColor",
                }),
              ],
            },
          },
        },
      ],
    },
    {
      type: "view",
      layout: "border",
      spacing: 10,
      constraints: { region: "bottom" },
      components: [
        label(
          "ramadanNote",
          `${month.days.length} days · ${month.days[0]!.timezone} · ${month.stale ? "Cached · refresh failed" : "Aladhan"}\nImsak is precautionary; Fajr is listed separately. Confirm local practice.`,
          {
            font: { size: 11 },
            colour: month.stale ? "systemOrangeColor" : "secondaryLabelColor",
            linebreak: "wordwrap",
            constraints: { region: "centre", size: { width: 540 } },
          },
        ),
        button("copyRamadan", "Copy Timetable", run("copy-ramadan", [String(year)]), {
          constraints: { region: "right" },
        }),
      ],
    },
  ],
});
export const ramadanSheet = (settings: Settings, year: number, month: Month): Action =>
  sheet("ramadanSheet", ramadanContent(settings, year, month), true, run("ramadan-back", [], false));
