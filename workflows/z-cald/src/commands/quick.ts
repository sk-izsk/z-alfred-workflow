import { randomUUID } from "node:crypto";
import { addDays, dateKey, isoWeek, parseDate, shiftMonth } from "../dates.ts";
import { bool, str } from "../env.ts";
import { type Action, copy, finish, menuItem, merge, popup, script, separator, update, vars } from "../ui.ts";
import { compactDays, dayId, quickTable } from "../../ui/quick-table.ts";

export const calendarMarkdown = (
  month: Date,
  weekStart: 0 | 1,
  showWeeks: boolean,
  today = new Date(),
): string => {
  const heading = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    addDays(new Date(2024, 0, 7 + weekStart, 12), i).toLocaleDateString(undefined, { weekday: "short" }),
  );
  const days = compactDays(month, weekStart);
  const headers = [...(showWeeks ? ["#"] : []), ...weekdays];
  const lines = [
    `# ${heading}`,
    "",
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => ":---:").join(" | ")} |`,
  ];
  for (let i = 0; i < days.length; i += 7) {
    const week = days.slice(i, i + 7);
    const number = isoWeek(addDays(parseDate(week[0]!.date), weekStart === 0 ? 1 : 0));
    const values = week.map((d) =>
      d.currentMonth ? `${d.date === dateKey(today) ? "• " : ""}${d.day}` : " ",
    );
    lines.push(`| ${[...(showWeeks ? [String(number)] : []), ...values].join(" | ")} |`);
  }
  return lines.join("\n");
};

const navigate = (args: string[]): Action[] => [
  script(args),
  script(["quick-preview", "{var:cal_selected}"], true),
];

export const quick = async ([action = "init", value = ""]: string[]): Promise<Action> => {
  const weekStart: 0 | 1 = str("week_start", "1") === "0" ? 0 : 1;
  const showWeeks = bool("show_weeks", true);
  let month = process.env.cal_month ? parseDate(process.env.cal_month) : shiftMonth(new Date(), 0);
  if (action === "init" && /^\d{4}-\d{2}(-\d{2})?$/.test(value))
    month = shiftMonth(parseDate(value.length === 7 ? `${value}-01` : value), 0);
  const initial = dateKey(new Date()).startsWith(dateKey(month).slice(0, 7))
    ? dateKey(new Date())
    : dateKey(month);
  let selected = process.env.cal_selected || initial;
  if (action === "shift") {
    const delta = Number(value);
    if (![-12, -1, 1, 12].includes(delta)) throw new Error("Invalid month change.");
    month = shiftMonth(month, delta);
    selected = dateKey(month);
  }
  if (action === "today") {
    month = shiftMonth(new Date(), 0);
    selected = dateKey(new Date());
  }
  if (action === "init")
    selected = value.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(value) ? dateKey(parseDate(value)) : initial;
  if (action === "menu")
    return popup("actionsButton", [
      { text: "Current Month\tC / ↩", action: navigate(["quick", "today"]) },
      menuItem("Copy Calendar to Clipboard", ["quick", "copy-calendar"], "⌘↩"),
      separator,
      { text: "Previous Month\t←", action: navigate(["quick", "shift", "-1"]) },
      { text: "Next Month\t→", action: navigate(["quick", "shift", "1"]) },
      separator,
      { text: "Previous Year\t⇧←", action: navigate(["quick", "shift", "-12"]) },
      { text: "Next Year\t⇧→", action: navigate(["quick", "shift", "12"]) },
      separator,
      {
        text: "Selected Date",
        submenu: [
          menuItem("View Events", ["quick", "agenda", selected], "⌘O"),
          menuItem("Create Event", ["quick", "create", selected], "⌘N"),
          menuItem("Copy Date", ["quick", "copy", selected], "⌘C"),
        ],
      },
    ]);
  if (action === "copy-calendar") return copy(calendarMarkdown(month, weekStart, showWeeks));
  if (["agenda", "create", "copy"].includes(action)) {
    const day = dateKey(parseDate(value || selected));
    if (action === "copy") return copy(day);
    return finish({ cal_out: action, cal_day: day });
  }
  if (action === "move" || action === "pick") {
    const previous = selected;
    if (action === "move") {
      const delta = Number(value);
      if (![-7, -1, 1, 7].includes(delta)) throw new Error("Invalid day change.");
      selected = dateKey(addDays(parseDate(selected), delta));
    } else selected = dateKey(parseDate(value));
    if (selected.slice(0, 7) === dateKey(month).slice(0, 7))
      return merge(
        vars({ cal_selected: selected, cal_preview: "" }),
        update({
          [dayId(previous)]: { background: null },
          [`${dayId(previous)}Button`]: { contenttintcolour: "labelColor" },
          [dayId(selected)]: { background: "alfredSelectedResultBackgroundColor" },
          [`${dayId(selected)}Button`]: { contenttintcolour: "alfredSelectedResultTextColor" },
          statusLabel: { text: "Quick Calendar", tooltip: parseDate(selected).toLocaleDateString() },
        }),
      );
    month = shiftMonth(parseDate(selected), 0);
  }
  const title = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return merge(
    { replace: { ids: { calendarTable: quickTable(month, weekStart, showWeeks, selected) } } },
    vars({
      cal_month: dateKey(month),
      cal_selected: selected,
      cal_preview: "",
      ...(action === "init" ? { cal_window: randomUUID() } : {}),
    }),
    update({
      monthTitle: { text: title },
      statusLabel: { text: "Quick Calendar", tooltip: parseDate(selected).toLocaleDateString() },
    }),
  );
};
