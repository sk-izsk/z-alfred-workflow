// Splitwise API v3.0 with the user's API key from the Keychain. Field names follow the API.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BUNDLE_ID, cacheDir, readJson, writeJson } from "./env.ts";
import { run } from "./proc.ts";

const API = "https://secure.splitwise.com/api/v3.0";

export type Picture = { small?: string; medium?: string; large?: string };
export type Balance = { currency_code: string; amount: string };
export type Friend = {
  id: number;
  first_name: string;
  last_name?: string | null;
  picture: Picture;
  balance: Balance[];
  updated_at: string;
};
export type Group = { id: number; name: string; avatar: Picture; updated_at: string };
export type User = {
  id: number;
  first_name: string;
  last_name?: string | null;
  picture: Picture;
  default_currency: string;
};
export type Category = { id: number; name: string; subcategories?: Category[] };
export type ExpenseUser = {
  user: { id: number; first_name: string; last_name?: string | null; picture: Picture };
  user_id: number;
  paid_share: string;
  owed_share: string;
  net_balance: string;
};
export type Expense = {
  id: number;
  description: string;
  cost: string;
  currency_code: string;
  date: string;
  group_id: number | null;
  payment: boolean;
  repeats: boolean;
  repeat_interval: string | null;
  deleted_at: string | null;
  updated_at: string;
  created_at: string;
  created_by: { id: number; first_name: string } | null;
  updated_by: { id: number; first_name: string } | null;
  receipt: { original: string | null; large: string | null };
  users: ExpenseUser[];
};

// ---- Keychain: the API key never touches argv, prefs.plist or the cache ----

const ACCOUNT = "api-key";
export const DEMO = "demo";

export const readToken = async (): Promise<string | undefined> => {
  // ponytail: demo mode for README screenshots; shows the cache only, never calls Splitwise.
  if (process.env.sw_demo === "1") return DEMO;
  const { code, stdout } = await run("/usr/bin/security", [
    "find-generic-password",
    "-s",
    BUNDLE_ID,
    "-a",
    ACCOUNT,
    "-w",
  ]);
  if (code !== 0) return undefined;
  const value = stdout.trim();
  return value.startsWith("b64:")
    ? Buffer.from(value.slice(4), "base64").toString("utf8")
    : value || undefined;
};

/** `security -i` reads the command from stdin, so the key never shows up in `ps`. */
export const saveToken = async (token: string): Promise<void> => {
  const encoded = `b64:${Buffer.from(token.trim(), "utf8").toString("base64")}`;
  const { code, stderr } = await run("/usr/bin/security", ["-i"], {
    input: `add-generic-password -U -s "${BUNDLE_ID}" -a "${ACCOUNT}" -w "${encoded}"\n`,
  });
  if (code !== 0 || /error/i.test(stderr)) throw new Error(`Keychain write failed: ${stderr.trim()}`);
};

export const deleteToken = async (): Promise<void> => {
  await run("/usr/bin/security", ["delete-generic-password", "-s", BUNDLE_ID, "-a", ACCOUNT]);
};

// ---- HTTP ----

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;
let fetcher: Fetcher = (url, init) => fetch(url, init);
/** Tests replace the network here. */
export const setFetcher = (next: Fetcher): void => {
  fetcher = next;
};

export class AuthError extends Error {}

const call = async <T>(token: string, path: string, body?: Record<string, unknown>): Promise<T> => {
  const response = await fetcher(`${API}/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body && { "Content-Type": "application/json" }),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 401) throw new AuthError("Splitwise rejected the API key");
  if (!response.ok) throw new Error(`Splitwise answered HTTP ${response.status}`);
  return (await response.json()) as T;
};

/** Splitwise reports validation problems in `errors` with HTTP 200. */
export const errorText = (errors: unknown): string | undefined => {
  if (!errors || typeof errors !== "object") return undefined;
  const parts = Object.entries(errors as Record<string, unknown>).flatMap(([key, value]) =>
    (Array.isArray(value) ? value : [value]).map((v) =>
      key === "base" ? String(v) : `${key}: ${String(v)}`,
    ),
  );
  return parts.length ? parts.join("; ") : undefined;
};

export const currentUser = async (token: string) =>
  (await call<{ user: User }>(token, "get_current_user")).user;
export const friends = async (token: string) =>
  (await call<{ friends: Friend[] }>(token, "get_friends")).friends;
export const groups = async (token: string) =>
  (await call<{ groups: Group[] }>(token, "get_groups")).groups.filter((g) => g.id !== 0);
export const categories = async (token: string) =>
  (await call<{ categories: Category[] }>(token, "get_categories")).categories;
export const expenses = async (token: string, limit: number) =>
  (await call<{ expenses: Expense[] }>(token, `get_expenses?limit=${limit}`)).expenses.filter(
    (e) => !e.deleted_at,
  );

export type ExpenseParams = Record<string, string | number | boolean | undefined>;

export const createExpense = async (token: string, params: ExpenseParams): Promise<Expense> => {
  const result = await call<{ expenses: Expense[]; errors: unknown }>(token, "create_expense", params);
  const problem = errorText(result.errors);
  if (problem) throw new Error(problem);
  const expense = result.expenses[0];
  if (!expense) throw new Error("Splitwise did not return the new expense");
  return expense;
};

export const updateExpense = async (token: string, id: number, params: ExpenseParams): Promise<void> => {
  const result = await call<{ errors: unknown }>(token, `update_expense/${id}`, params);
  const problem = errorText(result.errors);
  if (problem) throw new Error(problem);
};

export const deleteExpense = async (token: string, id: number): Promise<void> => {
  const result = await call<{ success: boolean; errors: unknown }>(token, `delete_expense/${id}`, {});
  if (!result.success) throw new Error(errorText(result.errors) ?? "Splitwise did not delete the expense");
};

// ---- Split rules (from the Raycast extension, with exact cents) ----

/** Add Expense with a friend: you pay everything; you owe half rounded up, the friend the rest. */
export const friendSplit = (cost: string, me: number, friend: number): ExpenseParams => {
  const cents = Math.round(Number(cost) * 100);
  const mine = Math.ceil(cents / 2);
  return {
    users__0__user_id: me,
    users__0__paid_share: (cents / 100).toFixed(2),
    users__0__owed_share: (mine / 100).toFixed(2),
    users__1__user_id: friend,
    users__1__paid_share: "0.00",
    users__1__owed_share: ((cents - mine) / 100).toFixed(2),
  };
};

/**
 * Change Values: one payer, the cost split equally among `owes`. Shares always add up to the cost
 * exactly (Splitwise rejects a cent off); left-over cents go to the payer first.
 */
export const equalSplit = (cost: string, paid: number, owes: number[]): ExpenseParams => {
  const cents = Math.round(Number(cost) * 100);
  const people = [...new Set(owes)];
  const ordered = people.includes(paid) ? [paid, ...people.filter((id) => id !== paid)] : people;
  const base = Math.floor(cents / ordered.length);
  const extra = cents - base * ordered.length;
  const share = new Map(ordered.map((id, i) => [id, base + (i < extra ? 1 : 0)]));
  const params: ExpenseParams = {
    users__0__user_id: paid,
    users__0__paid_share: (cents / 100).toFixed(2),
    users__0__owed_share: ((share.get(paid) ?? 0) / 100).toFixed(2),
  };
  ordered
    .filter((id) => id !== paid)
    .forEach((id, i) => {
      params[`users__${i + 1}__user_id`] = id;
      params[`users__${i + 1}__paid_share`] = "0.00";
      params[`users__${i + 1}__owed_share`] = ((share.get(id) ?? 0) / 100).toFixed(2);
    });
  return params;
};

/** "Change Values" is offered only for expenses with one payer and an equal split. */
export const isEditable = (expense: Expense): boolean => {
  const payers = expense.users.filter((u) => Number(u.paid_share) > 0).length;
  const shares = expense.users.map((u) => Number(u.owed_share)).filter((n) => n > 0);
  return payers <= 1 && shares.every((n) => Math.abs(n - (shares[0] ?? 0)) <= 0.03);
};

export const validCost = (cost: string): boolean => /^\d+(\.\d{1,2})?$/.test(cost.trim());

// ---- Cache and pictures ----

export const cached = <T>(name: string): T | undefined =>
  readJson<T | undefined>(join(cacheDir(), `${name}.json`), undefined);
export const store = (name: string, value: unknown): void =>
  writeJson(join(cacheDir(), `${name}.json`), value);

const pictureFile = (url: string) =>
  join(cacheDir(), "pictures", `${createHash("sha1").update(url).digest("hex")}.img`);

/** Alfred UI can't show images from URLs: pictures are downloaded once into the cache. */
export const picturePath = (url: string | undefined): string | undefined =>
  url && existsSync(pictureFile(url)) ? pictureFile(url) : undefined;

export const downloadPictures = async (urls: (string | undefined)[]): Promise<void> => {
  mkdirSync(join(cacheDir(), "pictures"), { recursive: true });
  const missing = [...new Set(urls.filter((u): u is string => Boolean(u)))].filter((u) => !picturePath(u));
  await Promise.all(
    missing.slice(0, 40).map(async (url) => {
      try {
        const response = await fetcher(url, { signal: AbortSignal.timeout(4000) });
        if (response.ok) writeFileSync(pictureFile(url), Buffer.from(await response.arrayBuffer()));
      } catch {
        // a missing picture falls back to a symbol
      }
    }),
  );
};

/**
 * The receipt as a local file for a native image view (images and PDFs), cached by URL. Limited to
 * 15 MB; anything else is opened in the browser instead.
 */
export const receiptFile = async (url: string): Promise<string | undefined> => {
  const dir = join(cacheDir(), "receipts");
  mkdirSync(dir, { recursive: true });
  const base = join(dir, createHash("sha256").update(url).digest("hex").slice(0, 32));
  for (const ext of ["png", "jpg", "gif", "pdf", "heic", "webp"])
    if (existsSync(`${base}.${ext}`)) return `${base}.${ext}`;
  try {
    const response = await fetcher(url, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok || Number(response.headers.get("content-length")) > 15e6) return undefined;
    const type = (response.headers.get("content-type") ?? "").split(";")[0]!.trim();
    const ext = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/gif": "gif",
      "application/pdf": "pdf",
      "image/heic": "heic",
      "image/webp": "webp",
    }[type];
    if (!ext) return undefined;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 15e6) return undefined;
    writeFileSync(`${base}.${ext}`, bytes);
    return `${base}.${ext}`;
  } catch {
    // offline or the link expired: the sheet offers Open in Browser
    return undefined;
  }
};

export const fullName = (person: { first_name: string; last_name?: string | null }) =>
  [person.first_name, person.last_name].filter(Boolean).join(" ");
