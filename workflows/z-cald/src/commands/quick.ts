import { addDays, dateKey, isoWeek, monthGrid, parseDate, shiftMonth } from "../dates.ts";
import { bool, str } from "../env.ts";
import { type Action, copy, finish, menuItem, merge, popup, status, update, vars } from "../ui.ts";

export const quickRows = (month: Date, weekStart: 0 | 1, today = new Date()): Action[] =>
  monthGrid(month, weekStart).map((day) => ({
    uid: day.date,
    "dayNumber.text": String(day.day),
    "dayNumber.colour":
      day.date === dateKey(today) ? "systemRedColor" : day.currentMonth ? "labelColor" : "tertiaryLabelColor",
    "todayMarker.text": day.date === dateKey(today) ? "Today" : "",
    "dayCell.background": day.date === dateKey(today) ? "#ff453a18" : null,
  }));

export const quick = async ([action = "init", value = ""]: string[]): Promise<Action> => {
  const weekStart: 0 | 1 = str("week_start", "1") === "0" ? 0 : 1;
  const showWeeks = bool("show_weeks", true);
  let month = process.env.cal_month ? parseDate(process.env.cal_month) : shiftMonth(new Date(), 0);
  if (action === "init" && /^\d{4}-\d{2}(-\d{2})?$/.test(value))
    month = shiftMonth(parseDate(value.length === 7 ? `${value}-01` : value), 0);
  if (action === "shift") {
    const delta = Number(value);
    if (![-12, -1, 1, 12].includes(delta)) throw new Error("Invalid month change.");
    month = shiftMonth(month, delta);
  }
  if (action === "today") month = shiftMonth(new Date(), 0);
  if (action === "menu")
    return popup("actionsButton", [
      menuItem("Current Month", ["quick", "today"], "⌘T"),
      menuItem("View Events on Selected Date", ["quick", "agenda", value], "↩"),
      menuItem("Create Event on Selected Date", ["quick", "create", value], "⌘N"),
      menuItem("Copy Selected Date", ["quick", "copy", value], "⌘C"),
    ]);
  if (["agenda", "create", "copy", "selected"].includes(action)) {
    const selected = dateKey(parseDate(value));
    if (action === "copy") return copy(selected);
    if (action === "selected")
      return status(
        parseDate(selected).toLocaleDateString(undefined, {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      );
    return finish({ cal_out: action, cal_day: selected });
  }
  const title = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    addDays(new Date(2024, 0, 7 + weekStart, 12), i).toLocaleDateString(undefined, { weekday: "short" }),
  );
  const cells = quickRows(month, weekStart);
  const grid = monthGrid(month, weekStart);
  return merge(
    update({
      days: {
        data: { src: cells },
        select: cells.some((c) => c.uid === dateKey(new Date())) ? dateKey(new Date()) : dateKey(month),
      },
    }),
    vars({ cal_month: dateKey(month) }),
    update({
      monthTitle: { text: title },
      weekCaption: { text: showWeeks ? "ISO" : "" },
      ...Object.fromEntries(weekdays.map((text, i) => [`weekday${i}`, { text }])),
      ...Object.fromEntries(
        Array.from({ length: 6 }, (_, i) => [
          `week${i}`,
          {
            text: showWeeks
              ? String(isoWeek(addDays(parseDate(grid[i * 7]!.date), weekStart === 0 ? 1 : 0)))
              : "",
          },
        ]),
      ),
    }),
    status("←/→ month · ⇧←/⇧→ year · ⌘T today · ↑/↓ select week"),
  );
};
