import { currentTabUrl } from "../browser.ts";
import { bool, str } from "../env.ts";
import * as session from "../session.ts";
import { formatCode, totpCode, totpPeriod, totpRemaining } from "../totp.ts";
import { type Action, fn, merge, status, update, vars } from "../ui.ts";
import {
  buildRows,
  type Cache,
  loadVaultData,
  type Folder,
  type Item,
  ItemType,
  readCache,
} from "../vault.ts";
import { baseDomain, hostOf, matchesSite } from "../uri.ts";
import { authSheet } from "./account.ts";

const SYNC_AFTER_MS = 5 * 60_000;

const folderItems = (folders: Folder[]) => [
  { text: "All Items", value: "all" },
  { type: "separator" },
  ...folders.filter((f) => f.id).map((f) => ({ text: f.name, value: f.id })),
  { type: "separator" },
  { text: "No Folder", value: "none" },
];

const ago = (ms: number): string => {
  const minutes = Math.round((Date.now() - ms) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
};

const summary = (cache: Cache, suggested: number): string =>
  [
    session.readState().email,
    `${cache.items.length} items`,
    suggested > 0 && `${suggested} for this site`,
    `synced ${ago(cache.syncedAt)}`,
  ]
    .filter(Boolean)
    .join(" · ");

const rowsUpdate = (cache: Cache, folder: string, pageUrl: string): Action => {
  const rows = buildRows(cache, folder, pageUrl);
  return merge(
    update({ items: { data: { src: rows } } }),
    fn({ items: ["filterdata", "selectfirst"] }),
    status(summary(cache, rows.filter((r) => !r["rowSuggested.hidden"]).length)),
  );
};

/** TOTP keys for the footer code, kept only in this window's memory. */
const totpSeeds = (items: { id: string; reprompt: 0 | 1; login?: { totp: string | null } }[]): string =>
  JSON.stringify(
    Object.fromEntries(
      // Re-prompt items keep their code hidden, like Bitwarden does.
      items.filter((i) => i.login?.totp && i.reprompt !== 1).map((i) => [i.id, i.login?.totp]),
    ),
  );

/**
 * Usernames/passwords for instant autofill, kept only in this window's memory (a UI variable),
 * so ↩ needs no `bw` call. Re-prompt items are left out; they fetch after the password check.
 */
const fillData = (items: Item[]): string =>
  JSON.stringify(
    Object.fromEntries(
      items
        .filter((i) => i.type === ItemType.Login && i.reprompt !== 1)
        .map((i) => [
          i.id,
          { u: i.login?.username ?? "", p: i.login?.password ?? "", t: i.login?.totp ?? "" },
        ]),
    ),
  );

export type SiteMode = "filter" | "pin" | "off";
export const siteMode = (): SiteMode => str("site_match", "filter") as SiteMode;

/**
 * launched (async): look at the front browser tab. "filter" puts the site name in the
 * search field (delete it to see everything); "pin" moves matching items to the top.
 */
export const site = async (): Promise<Action> => {
  const mode = siteMode();
  const cache = readCache();
  if (mode === "off" || !cache) return {};
  const url = await currentTabUrl().catch(() => "");
  if (!url || !cache.items.some((m) => matchesSite(m.uris, url))) return vars({ page_url: url });
  const label = baseDomain(hostOf(url)).split(".")[0] ?? "";
  const typed = (process.env.query ?? "").trim();
  return merge(
    vars({ page_url: url }),
    mode === "filter" && !typed && label !== "" && update({ searchField: { text: label } }),
    rowsUpdate(cache, process.env.folder_filter || "all", url),
  );
};

/** preload: instant, from cache. Never calls bw. */
export const init = async (): Promise<Action> => {
  const cache = readCache();
  const folder = process.env.folder_filter || "all";
  // No browser lookup here: preload blocks the window, so that happens in `site` after launch.
  const pageUrl = "";
  const state = await session.status();
  return merge(
    vars({ page_url: pageUrl, totp_seeds: "" }),
    cache && update({ folderPicker: { items: folderItems(cache.folders), selected: folder } }),
    cache ? rowsUpdate(cache, folder, pageUrl) : status(state === "unlocked" ? "Loading vault…" : "Locked"),
  );
};

/** Fetch the vault (sync first when stale) and refresh the list. */
export const loadVault = async (active: string, force = false): Promise<Action> => {
  // Bind to the unlock this load started under, not whichever one exists when it finishes.
  const binding = session.windowBinding();
  const stale = Date.now() - (readCache()?.syncedAt ?? 0) > SYNC_AFTER_MS;
  const vault = await loadVaultData(active, force || (bool("sync_on_open", true) && stale));
  const cache = readCache();
  if (!cache) return status("Vault is empty");
  // The site lookup runs in parallel (`site`); never wait for the browser here.
  const pageUrl = str("page_url");
  return merge(
    vars({
      totp_seeds: totpDisplay() === "off" ? "" : totpSeeds(vault.items),
      fill_data: fillData(vault.items),
      page_url: pageUrl,
      ...binding,
    }),
    // A pulse only starts when a script turns it on (same as the Authenticator).
    totpDisplay() !== "off" && { pulse: { interval: 1 } },
    update({
      folderPicker: { items: folderItems(cache.folders), selected: process.env.folder_filter || "all" },
    }),
    rowsUpdate(cache, process.env.folder_filter || "all", pageUrl),
  );
};

/** launched (async): refresh in the background; auto Touch ID when locked. */
export const refresh = async (): Promise<Action> => {
  const active = await session.getSession();
  if (active)
    return loadVault(active).catch((e) =>
      status(e instanceof Error ? e.message : String(e), "systemRedColor"),
    );
  const { quickUnlock } = await import("./account.ts");
  const unlocked = await quickUnlock(["search", "auto"]);
  return Object.keys(unlocked).length ? unlocked : authSheet("search");
};

export const sync = async (): Promise<Action> => {
  const active = await session.getSession();
  if (!active) return merge(status("Locked"), await authSheet("search"));
  return loadVault(active, true);
};

/** Folder picker changed. */
export const folder = ([value = "all"]: string[]): Action => {
  const cache = readCache();
  return merge(vars({ folder_filter: value }), cache && rowsUpdate(cache, value, str("page_url")));
};

const PRIMARY: Record<string, string> = {
  fill: "Autofill",
  // Never longer than "Autofill": Alfred sizes the button once, from its first text.
  "paste-password": "Paste",
  "copy-password": "Copy",
};

export type TotpDisplay = "footer" | "row" | "off";
export const totpDisplay = (): TotpDisplay => {
  const value = str("totp_display", "footer");
  return value === "row" || value === "off" ? value : "footer";
};

const seedsFromEnv = (): Record<string, string> => {
  try {
    return JSON.parse(process.env.totp_seeds || "{}") as Record<string, string>;
  } catch {
    return {};
  }
};

/** Code + colour for a TOTP key, or undefined for a broken key. */
const codeFor = (seed: string, now = Date.now()) => {
  if (!seed) return undefined;
  try {
    const left = totpRemaining(seed, now);
    return { code: formatCode(totpCode(seed, now)), left, period: totpPeriod(seed), urgent: left <= 5 };
  } catch {
    return undefined;
  }
};

/** Selection changed: footer shows the primary action (and the TOTP in footer mode). */
export const selected = async ([id = ""]: string[]): Promise<Action> => {
  const meta = readCache()?.items.find((m) => m.id === id);
  if (!meta) return update({ totpLabel: { text: "" } });
  const primary =
    meta.type === ItemType.Login ? (PRIMARY[str("enter_action", "fill")] ?? "Autofill") : "Details";
  const footerMode = totpDisplay() === "footer";
  if (totpDisplay() === "row") return update({ primaryButton: { text: `${primary}  ↩` } });
  // Retained seeds only produce a code while this window still belongs to the current unlock.
  const code = footerMode && (await session.windowValid()) ? codeFor(seedsFromEnv()[id] ?? "") : undefined;
  const isProtected = footerMode && meta.hasTotp && meta.reprompt === 1;
  const totp: Action = code
    ? {
        text: `${code.code}  ${code.left}s`,
        colour: code.urgent ? "systemRedColor" : "labelColor",
      }
    : isProtected
      ? { text: "••• •••  🔒", colour: "tertiaryLabelColor" }
      : { text: "" };
  return update({ primaryButton: { text: `${primary}  ↩` }, totpLabel: totp });
};

const PERIOD_MS = 30_000;

/** TOTP rows with their current code and expiry colour (row mode). */
const codeRows = (cache: Cache, seeds: Record<string, string>, now = Date.now()) =>
  buildRows({ ...cache, items: cache.items.filter((m) => seeds[m.id]) }, "all", str("page_url")).map(
    (row) => {
      const code = codeFor(seeds[row.uid] ?? "", now);
      return {
        ...row,
        "rowCode.text": code?.code ?? "",
        "rowCode.hidden": !code,
        "rowCode.colour": code?.urgent ? "systemRedColor" : "labelColor",
      };
    },
  );

/**
 * Every second. Footer mode: the selected item's code + seconds in the footer. Row mode: only
 * the countdown in the footer; rows refresh when codes change or enter their final 5 seconds,
 * because any row refresh makes Alfred scroll back to the selection.
 */
export const tick = async ([id = process.env.selected_id ?? ""]: string[]): Promise<Action> => {
  const display = totpDisplay();
  if (display === "off" || !process.env.window_session) return {};
  // After a lock or account change the window must drop its secrets instead of showing codes.
  if (!(await session.windowValid()))
    return merge(
      vars({ totp_seeds: "", fill_data: "", window_session: "" }),
      status("Vault locked. Reopen to unlock.", "systemOrangeColor"),
      { pulse: { interval: 0 } },
    );
  if (display === "footer") return selected([id]);
  const now = Date.now();
  const left = 30 - (Math.floor(now / 1000) % 30);
  const timer = update({
    totpLabel: { text: `⏱ ${left}s`, colour: left <= 5 ? "systemRedColor" : "secondaryLabelColor" },
  });
  const period = `${Math.floor(now / PERIOD_MS)}:${left <= 5}`;
  const seeds = seedsFromEnv();
  const cache = readCache();
  if (period === process.env.totp_period || !cache || !Object.keys(seeds).length) return timer;
  const srcmap = Object.fromEntries(codeRows(cache, seeds, now).map((r) => [r.uid, r]));
  return merge(
    timer,
    vars({ totp_period: period }),
    update({ items: { data: { modify: { replace: { autoselect: false, srcmap } } } } }),
  );
};

// --- accounts ---

const accountView = async (): Promise<Action> => {
  const cache = readCache();
  const base = merge(
    vars({ totp_seeds: "" }),
    update({ items: { data: { src: [] } } }),
    cache ? rowsUpdate(cache, "all", str("page_url")) : status("Loading…"),
  );
  const active = await session.getSession();
  return merge(base, active ? await loadVault(active) : await authSheet("search"));
};

export const addAccount = async (): Promise<Action> => {
  session.addAccount();
  return merge(update({ items: { data: { src: [] } } }), status("New account"), await authSheet("search"));
};

export const switchAccount = async ([id = ""]: string[]): Promise<Action> => {
  await session.switchAccount(id);
  return accountView();
};
