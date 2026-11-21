import { existsSync } from "node:fs";
import { clearLog, debugOn, logPath } from "../log.ts";
import { readAccounts } from "../env.ts";
import { run } from "../proc.ts";
import * as session from "../session.ts";

/**
 * The `bw` Script Filter: one menu for everything.
 * `bw` → all commands; `bw auth` → Authenticator; `bw git` → "Search vault for 'git'".
 * Each item sets `bw_target` (which window) or `bw_action` (do it, then notify).
 */
type Entry = {
  title: string;
  subtitle: string;
  icon: string;
  target?: string;
  action?: string;
  account?: string;
  words?: string;
  autocomplete?: string;
};

const COMMANDS: Entry[] = [
  {
    title: "Search Vault",
    subtitle: "Search, autofill and copy from your vault",
    icon: "SEARCHKW.png",
    target: "search",
  },
  {
    title: "Authenticator",
    subtitle: "Live TOTP codes",
    icon: "AUTHKW.png",
    target: "auth",
    words: "totp otp 2fa code",
  },
  {
    title: "Generate Password",
    subtitle: "Password or passphrase",
    icon: "GENKW.png",
    target: "gen",
    words: "passphrase",
  },
  {
    title: "Generate Password (Quick)",
    subtitle: "Generate with saved settings and paste",
    icon: "QUICKKW.png",
    action: "quick-gen",
  },
  {
    title: "Sends",
    subtitle: "Create, copy and receive Bitwarden Sends",
    icon: "SENDSKW.png",
    target: "sends",
    words: "share",
  },
  {
    title: "New Login or Note",
    subtitle: "Save a new item",
    icon: "NEWKW.png",
    target: "new",
    words: "create add item",
  },
  { title: "Sync Vault", subtitle: "Pull the latest changes", icon: "SYNCKW.png", action: "sync" },
  { title: "Lock Vault", subtitle: "Lock now", icon: "LOCKKW.png", action: "lock" },
  {
    title: "Log Out",
    subtitle: "Log out of this account",
    icon: "LOGOUTKW.png",
    action: "logout",
    words: "sign out",
  },
];

/** Typing this after the keyword shows the account list (`bw account …`). */
const ACCOUNT_PREFIX = "account ";

/** Main menu entry: ↩ drills into the account list (Alfred autocomplete, not an action). */
const SWITCH_ENTRY: Entry = {
  title: "Switch Account…",
  subtitle: "Pick one of your saved Bitwarden accounts",
  icon: "icon.png",
  autocomplete: ACCOUNT_PREFIX,
  words: "account accounts switch login",
};

/** The account list: saved logins (current one marked) + Add Account. */
const accountEntries = (): Entry[] => {
  const { active } = readAccounts();
  return [
    // Current account first.
    ...session
      .allAccounts()
      .toSorted((a, b) => Number(b.id === active) - Number(a.id === active))
      .map((a) => ({
        title: a.email || a.id,
        subtitle:
          a.id === active ? "Current account" : "Switch to this account (asks Touch ID / PIN / password)",
        icon: "icon.png",
        action: a.id === active ? undefined : "switch",
        target: a.id === active ? "search" : undefined,
        account: a.id,
        words: a.server,
      })),
    {
      title: "Add Account…",
      subtitle: "Log in to another Bitwarden account",
      icon: "icon.png",
      action: "add-account",
      words: "add new login",
    },
  ];
};

/** Every query word must start a word in the title or the extra keywords. */
export const matches = (entry: Entry, query: string): boolean => {
  const haystack = `${entry.title} ${entry.words ?? ""}`.toLowerCase().split(/[^a-z0-9@.]+/);
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((q) => haystack.some((w) => w.startsWith(q)));
};

const toItem = (entry: Entry, query: string) => ({
  title: entry.title,
  subtitle: entry.subtitle,
  arg: entry.target === "search" ? query : "",
  icon: { path: entry.icon },
  // An autocomplete entry isn't actioned: ↩ fills the query instead (drill-down).
  valid: !entry.autocomplete,
  ...(entry.autocomplete && { autocomplete: entry.autocomplete }),
  variables: {
    bw_target: entry.target ?? "action",
    bw_action: entry.action ?? "",
    bw_account: entry.account ?? "",
  },
});

/** Shown when "Debug log" is on, or a log already exists (errors are always logged). */
const debugEntries = (): Entry[] =>
  debugOn() || existsSync(logPath())
    ? [
        {
          title: "Debug Log",
          subtitle: "Open the timing + error log in Console",
          icon: "icon.png",
          action: "open-log",
          words: "log debug error",
        },
        {
          title: "Clear Debug Log",
          subtitle: logPath(),
          icon: "icon.png",
          action: "clear-log",
          words: "log debug",
        },
      ]
    : [];

export const rootItems = (query: string) => {
  const q = query.trimStart();
  if (q.toLowerCase().startsWith(ACCOUNT_PREFIX.trim())) {
    const rest = q.slice(ACCOUNT_PREFIX.trim().length).trim();
    return accountEntries()
      .filter((e) => !rest || matches(e, rest))
      .map((e) => toItem(e, ""));
  }
  const all = [...COMMANDS, SWITCH_ENTRY, ...debugEntries()];
  if (!q.trim()) return all.map((e) => toItem(e, ""));
  const hits = all.filter((e) => matches(e, q.trim()));
  const searchItem = { ...toItem(COMMANDS[0]!, q.trim()), title: `Search vault for “${q.trim()}”` };
  return hits.some((e) => e.target === "search")
    ? hits.map((e) => toItem(e, q.trim()))
    : [...hits.map((e) => toItem(e, q.trim())), searchItem];
};

export const root = async ([query = ""]: string[]): Promise<void> => {
  process.stdout.write(JSON.stringify({ items: rootItems(query) }));
};

/** Open a window through its External Trigger (after switching / adding an account). */
const openWindow = (trigger: string) =>
  run("/usr/bin/osascript", [
    "-e",
    `tell application id "com.runningwithcrayons.Alfred" to run trigger "${trigger}" in workflow "com.izsk.bitwarden"`,
  ]);

const ACTIONS: Record<string, () => Promise<string>> = {
  "open-log": async () => {
    if (!existsSync(logPath())) clearLog();
    await run("/usr/bin/open", ["-a", "Console", logPath()]);
    return "";
  },
  "clear-log": async () => (clearLog(), "Debug log cleared"),
  "quick-gen": async () => {
    const { genQuick } = await import("./generator.ts");
    await genQuick();
    return "";
  },
  sync: async () => {
    const { syncCommand } = await import("./account.ts");
    await syncCommand();
    return "";
  },
  lock: async () => (await session.lock(), "Vault locked"),
  logout: async () => (await session.logout(), "Logged out of Bitwarden"),
  switch: async () => {
    await session.switchAccount(process.env.bw_account ?? "");
    // Ask for Touch ID before the window opens (the prompt would otherwise close it).
    if (session.quickUnlockMode() === "touchid" && (await session.canQuickUnlock())) {
      await session.quickUnlock().catch(() => session.writeState({ autoCancelledAt: Date.now() }));
    }
    await openWindow("search");
    return "";
  },
  "add-account": async () => {
    session.addAccount();
    await openWindow("search");
    return "";
  },
};

export const rootAction = async (): Promise<void> => {
  const action = ACTIONS[process.env.bw_action ?? ""];
  if (action) process.stdout.write(await action());
};
