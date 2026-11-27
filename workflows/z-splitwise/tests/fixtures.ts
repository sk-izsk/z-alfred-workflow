// Synthetic Splitwise data (made-up people), shaped like the API responses.
import type { Category, Expense, Friend, Group, User } from "../src/api.ts";

const iso = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
const person = (id: number, first_name: string) => ({ id, first_name, last_name: null, picture: {} });

export const user: User = { ...person(1, "Alex"), default_currency: "EUR" };
export const friends: Friend[] = [
  { ...person(2, "Robin"), balance: [{ currency_code: "EUR", amount: "15.0" }], updated_at: iso(38) },
  { ...person(3, "Sam"), balance: [{ currency_code: "EUR", amount: "-7.5" }], updated_at: iso(300) },
  { ...person(4, "Jamie"), balance: [], updated_at: iso(60 * 24 * 9) },
];
export const groups: Group[] = [
  { id: 10, name: "Funkytown", avatar: {}, updated_at: iso(120) },
  { id: 11, name: "Flatmates", avatar: {}, updated_at: iso(60 * 24 * 30) },
];
export const categories: Category[] = [
  { id: 12, name: "Food and drink", subcategories: [{ id: 13, name: "Dining out" }] },
  { id: 18, name: "General" },
];
const share = (id: number, first: string, paid: string, owed: string, net: string) => ({
  user: person(id, first),
  user_id: id,
  paid_share: paid,
  owed_share: owed,
  net_balance: net,
});
const expense = (id: number, description: string, extra: Partial<Expense> = {}): Expense => ({
  id,
  description,
  cost: "10.0",
  currency_code: "EUR",
  date: "2026-01-04T12:00:00Z",
  group_id: 10,
  payment: false,
  repeats: false,
  repeat_interval: null,
  deleted_at: null,
  updated_at: "2026-01-04T12:19:00Z",
  created_at: "2026-01-04T12:00:00Z",
  created_by: { id: 1, first_name: "Alex" },
  updated_by: { id: 1, first_name: "Alex" },
  receipt: { original: null, large: null },
  users: [share(1, "Alex", "10.0", "5.0", "5.0"), share(2, "Robin", "0.0", "5.0", "-5.0")],
  ...extra,
});
export const expenses: Expense[] = [
  expense(1001, "Test1234"),
  expense(1002, "Payment", { payment: true, group_id: null }),
  expense(1003, "Pizza", { repeats: true, repeat_interval: "monthly" }),
];
export const unequal: Expense = expense(1004, "Groceries", {
  users: [share(1, "Alex", "10.0", "7.0", "3.0"), share(2, "Robin", "0.0", "3.0", "-3.0")],
});
