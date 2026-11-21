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

export type TotpDisplay = "row" | "footer" | "off";
export const totpDisplay = (): TotpDisplay => str("totp_display", "row") as TotpDisplay;

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
export const selected = ([id = ""]: string[]): Action => {
  const meta = readCache()?.items.find((m) => m.id === id);
  if (!meta) return update({ totpLabel: { hidden: true } }, true);
  const primary =
    meta.type === ItemType.Login ? (PRIMARY[str("enter_action", "fill")] ?? "Autofill") : "Details";
  // Footer mode only; in row mode the codes live on the rows.
  const footerMode = totpDisplay() === "footer";
  const code = footerMode ? codeFor(seedsFromEnv()[id] ?? "") : undefined;
  const isProtected = footerMode && meta.hasTotp && meta.reprompt === 1;
  const totp: Action = code
    ? {
        hidden: false,
        text: `${code.code}  ${code.left}s`,
        colour: code.urgent ? "systemRedColor" : "secondaryLabelColor",
      }
    : isProtected
      ? { hidden: false, text: "••• •••  🔒", colour: "tertiaryLabelColor" }
      : { hidden: true };
  return update({ primaryButton: { text: `${primary}  ↩` }, totpLabel: totp }, true);
};

/**
 * Every second: in row mode, replace just the TOTP rows in place (selection and filter stay,
 * same trick as the Authenticator); in footer mode, refresh the selected item's code.
 */
export const tick = ([id = process.env.selected_id ?? ""]: string[]): Action => {
  const display = totpDisplay();
  if (display === "footer") return selected([id]);
  if (display !== "row") return {};
  const seeds = seedsFromEnv();
  const cache = readCache();
  if (!cache || !Object.keys(seeds).length) return {};
  const now = Date.now();
  const withTotp = { ...cache, items: cache.items.filter((m) => seeds[m.id]) };
  const srcmap = Object.fromEntries(
    buildRows(withTotp, "all", str("page_url")).map((row) => {
      const code = codeFor(seeds[row.uid] ?? "", now);
      return [
        row.uid,
        {
          ...row,
          "rowCode.text": code?.code ?? "",
          "rowCode.hidden": !code,
          "rowCode.colour": code?.urgent ? "systemRedColor" : "secondaryLabelColor",
          "rowTotp.hidden": Boolean(code),
          "rowRingBox.hidden": !code,
          "rowRing.progress": code ? code.left / code.period : 0,
          "rowRing.colour": code?.urgent ? "systemRedColor" : null,
          "rowSecs.text": code ? String(code.left) : "",
          "rowSecs.colour": code?.urgent ? "systemRedColor" : "secondaryLabelColor",
        },
      ];
    }),
  );
  return update({ items: { data: { modify: { replace: { autoselect: false, srcmap } } } } });
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
