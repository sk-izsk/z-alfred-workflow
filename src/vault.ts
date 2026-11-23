import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bw, bwJson } from "./bw.ts";
import { accountId, cacheDir, perAccountId } from "./env.ts";
import { cacheKey } from "./cachekey.ts";
import { isLegacyPlainCache, openCache, sealCache } from "./cachecrypt.ts";
import { cachedIcon, fetchIconsLater } from "./icons.ts";
import { hostOf, matchesSite } from "./uri.ts";

// --- Bitwarden shapes (only what we use) ---

export enum ItemType {
  Login = 1,
  Note = 2,
  Card = 3,
  Identity = 4,
  SshKey = 5,
}

export type Field = { name: string | null; value: string | null; type: 0 | 1 | 2 | 3 };
export type Item = {
  id: string;
  name: string;
  type: ItemType;
  folderId: string | null;
  favorite: boolean;
  reprompt: 0 | 1;
  notes: string | null;
  login?: {
    username: string | null;
    password: string | null;
    totp: string | null;
    uris?: { uri: string | null }[];
    fido2Credentials?: { rpId?: string; creationDate?: string }[];
  };
  card?: Record<string, string | null>;
  identity?: Record<string, string | null>;
  sshKey?: { privateKey: string; publicKey: string; keyFingerprint: string };
  fields?: Field[];
};
export type Folder = { id: string | null; name: string };

/** What we keep on disk between runs: no passwords, no TOTP keys, no notes, no card numbers. */
export type Meta = {
  id: string;
  name: string;
  type: ItemType;
  folderId: string | null;
  favorite: boolean;
  reprompt: 0 | 1;
  username: string;
  uris: string[];
  hasTotp: boolean;
  hasPassword: boolean;
  hasPasskey: boolean;
  brand: string;
};

export type Cache = { syncedAt: number; folders: Folder[]; items: Meta[] };

export const toMeta = (item: Item): Meta => ({
  id: item.id,
  name: item.name,
  type: item.type,
  folderId: item.folderId,
  favorite: item.favorite,
  reprompt: item.reprompt,
  username: item.login?.username ?? item.identity?.email ?? "",
  uris: (item.login?.uris ?? []).map((u) => u.uri ?? "").filter(Boolean),
  hasTotp: Boolean(item.login?.totp),
  hasPassword: Boolean(item.login?.password),
  hasPasskey: (item.login?.fido2Credentials?.length ?? 0) > 0,
  brand: item.card?.brand ?? "",
});

// --- cache ---

const cachePath = (account: string = accountId()) =>
  join(cacheDir(), `${perAccountId("cache", account)}.json`);

/**
 * The item-name cache (names, usernames, URLs, flags) is encrypted at rest, with a key in the Keychain.
 * An unreadable, tampered or old plaintext file counts as "no cache" and is removed.
 */
export const readCache = (account: string = accountId()): Cache | undefined => {
  try {
    const blob = readFileSync(cachePath(account));
    if (isLegacyPlainCache(blob)) {
      rmSync(cachePath(account));
      return undefined;
    }
    const key = cacheKey(account);
    const json = key && openCache(blob, key);
    return json ? (JSON.parse(json) as Cache) : undefined;
  } catch {
    return undefined;
  }
};

export const writeCache = (cache: Cache, account: string = accountId()): void => {
  const key = cacheKey(account);
  // No key means no cache: never fall back to writing names and URLs in plain text.
  if (!key) return rmSync(cachePath(account), { force: true });
  writeFileSync(cachePath(account), sealCache(JSON.stringify(cache), key), { mode: 0o600 });
};

// --- fetching ---

export type Vault = { items: Item[]; folders: Folder[] };

/** Full vault (with secrets) for this process only; the disk cache keeps the Meta subset. */
// --- encrypted full-vault cache ---
// The Bitwarden CLI can take ~3 s per call on some Macs. The full vault (with secrets) is kept
// on disk encrypted with AES-256-GCM, keyed by the unlock session (which lives in the Keychain).
// Locking deletes the session, so the file can't be read until the next unlock.

const FRESH_MS = 5 * 60_000;
const securePath = (account: string = accountId()) =>
  join(cacheDir(), `${perAccountId("vault", account)}.enc`);
const keyFor = (session: string) => createHash("sha256").update(`com.izsk.bitwarden:${session}`).digest();

const writeSecure = (session: string, vault: Vault, account: string = accountId()): void => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(session), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(vault), "utf8"), cipher.final()]);
  writeFileSync(securePath(account), Buffer.concat([iv, cipher.getAuthTag(), body]), { mode: 0o600 });
};

const readSecure = (session: string, maxAgeMs = Number.POSITIVE_INFINITY): Vault | undefined => {
  try {
    const path = securePath();
    if (Date.now() - statSync(path).mtimeMs > maxAgeMs) return undefined;
    const raw = readFileSync(path);
    const decipher = createDecipheriv("aes-256-gcm", keyFor(session), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8"),
    ) as Vault;
  } catch {
    return undefined; // missing, old session, or tampered
  }
};

/** Exposed for tests only. */
export const secureCache = { write: writeSecure, read: readSecure };

/** After any change (create/edit/delete) or lock, the next read goes to bw again. */
export const invalidateVault = (): void => {
  if (existsSync(securePath())) rmSync(securePath());
};

/** After a create, edit or delete the item-name cache is stale too (a lock keeps it, for a fast open). */
export const invalidateAllCaches = (): void => {
  invalidateVault();
  rmSync(cachePath(), { force: true });
};

export const fetchVault = async (session: string, sync = false): Promise<Vault> => {
  const { getSession, readState } = await import("./session.ts");
  const account = accountId();
  const generation = readState().sessionId;
  if (!generation) throw new Error("Vault is locked");
  if (sync) await bw(["sync"], { session });
  const [items, folders] = await Promise.all([
    bwJson<Item[]>(["list", "items"], { session }),
    bwJson<Folder[]>(["list", "folders"], { session }),
  ]);
  // A lock or account switch during the slow fetch must not write that vault back to the cache.
  // The live session must be the very one this fetch used, in the same account and unlock.
  const live = await getSession(false);
  if (live !== session || account !== accountId() || generation !== readState().sessionId)
    throw new Error("Vault changed or locked during refresh");
  const metas = items.map(toMeta);
  // Every path and key below uses the account captured when the fetch started, not whichever is active now.
  writeCache({ syncedAt: Date.now(), folders, items: metas }, account);
  writeSecure(session, { items, folders }, account);
  fetchIconsLater(metas.map((m) => hostOf(m.uris[0] ?? "")));
  return { items, folders };
};

/** The vault from the encrypted cache when fresh (instant), otherwise from bw (slow). */
export const loadVaultData = async (session: string, sync = false): Promise<Vault> => {
  // The cached copy only counts while an unlock generation exists (a lock may have raced us).
  if (!(await import("./session.ts")).readState().sessionId) throw new Error("Vault is locked");
  return (!sync && readSecure(session, FRESH_MS)) || fetchVault(session, sync);
};

/** One item: from the encrypted cache when possible, otherwise `bw get item`. */
export const getItem = async (session: string, id: string): Promise<Item> => {
  if (!(await import("./session.ts")).readState().sessionId) throw new Error("Vault is locked");
  return (
    readSecure(session)?.items.find((i) => i.id === id) ?? bwJson<Item>(["get", "item", id], { session })
  );
};

export const lastSync = async (session: string): Promise<number> =>
  Date.parse(await bw(["sync", "--last"], { session })) || 0;

// --- presentation ---

export const TYPE_SYMBOL: Record<ItemType, string> = {
  [ItemType.Login]: "globe",
  [ItemType.Note]: "note.text",
  [ItemType.Card]: "creditcard",
  [ItemType.Identity]: "person.crop.rectangle",
  [ItemType.SshKey]: "key.horizontal",
};

const subtitleOf = (meta: Meta): string => {
  if (meta.type === ItemType.Login) return meta.username || hostOf(meta.uris[0] ?? "");
  if (meta.type === ItemType.Card) return meta.brand;
  if (meta.type === ItemType.Identity) return meta.username;
  return "";
};

export type FolderFilter = "all" | "none" | string;

const inFolder = (meta: Meta, filter: FolderFilter) =>
  filter === "all" || (filter === "none" ? !meta.folderId : meta.folderId === filter);

/** Suggested (current site) first, then favorites, then A→Z. */
export const sortMetas = (metas: Meta[], pageUrl = ""): (Meta & { suggested: boolean })[] =>
  metas
    .map((m) => ({ ...m, suggested: pageUrl !== "" && matchesSite(m.uris, pageUrl) }))
    .toSorted(
      (a, b) =>
        Number(b.suggested) - Number(a.suggested) ||
        Number(b.favorite) - Number(a.favorite) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );

/** Website icon when cached, otherwise an SF Symbol for the item type. */
const iconFor = (meta: Meta) => {
  const file = meta.type === ItemType.Login ? cachedIcon(hostOf(meta.uris[0] ?? "")) : "";
  return file
    ? { "rowIcon.image.type": "file", "rowIcon.image.src": file }
    : {
        "rowIcon.image.type": "symbol",
        "rowIcon.image.src": TYPE_SYMBOL[meta.type] ?? "questionmark.square",
      };
};

/** One dataview entry. Keys are `componentId.property` inside the cell (see search.alfredui). */
export const toRow = (meta: Meta & { suggested: boolean }, folders: Folder[]) => {
  const folder = folders.find((f) => f.id && f.id === meta.folderId)?.name ?? "";
  const subtitle = subtitleOf(meta);
  return {
    uid: meta.id,
    ...iconFor(meta),
    "rowTitle.text": meta.name,
    "rowSubtitle.text": subtitle,
    "rowFolder.text": folder,
    "rowFolderPill.hidden": folder === "",
    "rowSuggested.hidden": !meta.suggested,
    "rowStar.hidden": !meta.favorite,
    "rowTotp.hidden": !meta.hasTotp,
    "rowCode.hidden": true,
    "rowLock.hidden": meta.reprompt !== 1,
    "rowPasskey.hidden": !meta.hasPasskey,
    match: [meta.name, meta.username, ...meta.uris.map(hostOf), folder].join(" "),
    type: meta.type,
    url: meta.uris[0] ?? "",
  };
};

export const buildRows = (cache: Cache, filter: FolderFilter = "all", pageUrl = "") =>
  sortMetas(
    cache.items.filter((m) => inFolder(m, filter)),
    pageUrl,
  ).map((m) => toRow(m, cache.folders));
