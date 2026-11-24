import { addDays, dateKey, isoWeek, monthGrid, parseDate } from "../src/dates.ts";
import { button, label, run, type Json } from "./shared.ts";

export const dayId = (date: string): string => `date-${date}`;
export const compactDays = (month: Date, weekStart: 0 | 1) => {
  const days = monthGrid(month, weekStart);
  const last = days.findLastIndex((day) => day.currentMonth);
  return days.slice(0, Math.ceil((last + 1) / 7) * 7);
};

/** One grid owns every column and border, including week numbers. No nested scroll views. */
export const quickTable = (month: Date, weekStart: 0 | 1, showWeeks: boolean, selected: string): Json => {
  const cells = compactDays(month, weekStart);
  const columns = showWeeks ? 8 : 7;
  const today = dateKey(new Date());
  const border = { width: 1, colour: { dark: "#ffffff12", light: "#00000012" } };
  const box = (id: string, content: Json, heading = false): Json => ({
    id,
    type: "view",
    layout: "stack",
    border,
    background: heading ? { dark: "#ffffff08", light: "#00000004" } : null,
    components: [content],
  });
  const heading = (id: string, text: string) =>
    box(
      id,
      label(`${id}Text`, {
        text,
        textalign: "centre",
        font: { size: 11, weight: "semibold" },
        constraints: { position: "centre" },
      }),
      true,
    );
  const components: Json[] = showWeeks ? [heading("weekHeading", "#")] : [];
  for (let i = 0; i < 7; i++) {
    const weekday = addDays(new Date(2024, 0, 7 + weekStart, 12), i)
      .toLocaleDateString(undefined, { weekday: "short" })
      .toUpperCase();
    components.push(heading(`weekday${i}`, weekday));
  }
  for (let i = 0; i < cells.length; i++) {
    const day = cells[i]!;
    if (showWeeks && i % 7 === 0)
      components.push(
        heading(`week${i / 7}`, String(isoWeek(addDays(parseDate(day.date), weekStart === 0 ? 1 : 0)))),
      );
    const active = day.date === selected && day.currentMonth;
    const cell = box(
      dayId(day.date),
      button(
        `${dayId(day.date)}Button`,
        day.currentMonth ? `${day.date === today ? "• " : ""}${day.day}` : "",
        [run(["quick", "pick", day.date]), run(["quick-preview", day.date], { async: true })],
        {
          enabled: day.currentMonth,
          font: { size: 13, weight: day.date === today ? "semibold" : "regular" },
          contenttintcolour: active ? "alfredSelectedResultTextColor" : "labelColor",
          tooltip: day.currentMonth
            ? parseDate(day.date).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })
            : "",
          constraints: { stretch: "both" },
        },
      ),
    );
    if (active) cell.background = "alfredSelectedResultBackgroundColor";
    components.push(cell);
  }
  return {
    id: "calendarTable",
    type: "view",
    layout: "grid",
    rows: cells.length / 7 + 1,
    cols: columns,
    spacing: 0,
    components,
    constraints: { stretch: "horizontal", size: { height: (cells.length / 7 + 1) * 32 } },
  };
};
