import { finish, type Action } from "./ui.ts";

type Screen = { type: "quick" | "agenda" | "create"; values: Record<string, string> };
type Context = { calendarNavigation: 1; screen: Screen; history: Screen[] };
const fields = [
  "cal_query",
  "cal_day",
  "cal_month",
  "cal_selected",
  "cal_filter",
  "cal_view",
  "cal_search",
  "cal_item",
] as const;
const validScreen = (value: unknown): value is Screen => {
  if (!value || typeof value !== "object") return false;
  const s = value as Screen;
  return (
    ["quick", "agenda", "create"].includes(s.type) &&
    !!s.values &&
    typeof s.values === "object" &&
    !Array.isArray(s.values) &&
    Object.entries(s.values).every(
      ([key, entry]) => fields.includes(key as (typeof fields)[number]) && typeof entry === "string",
    )
  );
};
const history = (): Screen[] => {
  const value: unknown = JSON.parse(process.env.cal_navigation || "[]");
  if (!Array.isArray(value) || value.length > 50 || !value.every(validScreen))
    throw new Error("Calendar navigation expired. Reopen Calendar.");
  return value;
};
export const decodeContext = (query: string): Context | undefined => {
  if (!query.startsWith('{"calendarNavigation":1,')) return;
  const value = JSON.parse(query) as Context;
  if (
    !validScreen(value.screen) ||
    !Array.isArray(value.history) ||
    value.history.length > 50 ||
    !value.history.every(validScreen)
  )
    throw new Error("Calendar navigation expired. Reopen Calendar.");
  return value;
};
export const contextFor = (type: Screen["type"], day: string, stack = history()): string =>
  JSON.stringify({
    calendarNavigation: 1,
    screen: { type, values: { cal_query: day, cal_day: day } },
    history: stack,
  } satisfies Context);
export const forward = (from: Screen["type"], target: "agenda" | "create", day: string): Action => {
  const screen: Screen = {
    type: from,
    values: Object.fromEntries(fields.map((key) => [key, process.env[key] || ""])),
  };
  return finish({
    cal_out: target,
    cal_day: day,
    cal_navigation: JSON.stringify([...history().slice(-49), screen]),
  });
};
export const back = (): Action => {
  const stack = history(),
    previous = stack.pop();
  return previous
    ? finish({
        cal_out: "return",
        cal_return: JSON.stringify({
          calendarNavigation: 1,
          screen: previous,
          history: stack,
        } satisfies Context),
      })
    : finish({ cal_out: "back" });
};
export const restoreContext = (query: string): Record<string, string> => {
  const context = decodeContext(query);
  if (!context) return {};
  return { ...context.screen.values, cal_navigation: JSON.stringify(context.history) };
};
