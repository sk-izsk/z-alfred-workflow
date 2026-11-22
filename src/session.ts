import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bw, bwDetached, bwJson } from "./bw.ts";
import {
  type Account,
  cacheDir,
  dataDir,
  num,
  perAccount,
  readAccounts,
  str,
  writeAccounts,
  accountId,
  DEFAULT_ACCOUNT,
} from "./env.ts";
import { keychainDelete, keychainGet, keychainSet } from "./keychain.ts";
import { authenticate } from "./touchid.ts";

export type State = {
  loggedIn?: boolean;
  email?: string;
  lastUsed?: number;
  masterHash?: string;
  pinHash?: string;
  pinFails?: number;
  repromptedAt?: number;
  /** Random per unlock, so work started before a lock can tell it is stale. */
  sessionId?: string;
  autoCancelledAt?: number;
};

const statePath = () => join(dataDir(), `${perAccount("state")}.json`);

export const readState = (): State => {
  try {
    return JSON.parse(readFileSync(statePath(), "utf8")) as State;
  } catch {
    return {};
  }
};

export const writeState = (patch: State): State => {
  const next = { ...readState(), ...patch };
  writeFileSync(statePath(), JSON.stringify(next), { mode: 0o600 });
  return next;
};

// --- password hashing (for re-prompt + PIN checks, never stored in clear) ---

export const hashSecret = (secret: string): string => {
  const salt = randomBytes(16);
  return `scrypt:${salt.toString("hex")}:${scryptSync(secret, salt, 32).toString("hex")}`;
};

export const verifySecret = (secret: string, stored = ""): boolean => {
  const [, salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = scryptSync(secret, Buffer.from(salt, "hex"), 32);
  return timingSafeEqual(actual, Buffer.from(hash, "hex"));
};

// --- settings ---

/** Minutes of inactivity before the vault locks; 0 = never. */
export const vaultTimeoutMs = (): number => {
  const minutes = num("vault_timeout", 15);
  return minutes > 0 ? minutes * 60_000 : 0; // 0 = never; non-numbers fall back to 15
};
export type QuickUnlock = "off" | "touchid" | "pin";
export const quickUnlockMode = (): QuickUnlock => str("quick_unlock", "off") as QuickUnlock;

// --- session ---

const touch = () => writeState({ lastUsed: Date.now() });

/** The session key if the vault is unlocked and not timed out. No bw call, so it's instant. */
export const getSession = async (): Promise<string | undefined> => {
  const session = await keychainGet("session");
  if (!session) return undefined;
  const timeout = vaultTimeoutMs();
  if (timeout > 0 && Date.now() - (readState().lastUsed ?? 0) > timeout) {
    await lock();
    return undefined;
  }
  touch();
  return session;
};

export type Status = "unauthenticated" | "locked" | "unlocked";

/** Cheap status from local state; `verify` asks bw (slower) and repairs local state. */
export const status = async (verify = false): Promise<Status> => {
  if (verify) {
    const session = await keychainGet("session");
    const real = await bwJson<{ status: Status; userEmail?: string }>(["status"], { session });
    writeState({ loggedIn: real.status !== "unauthenticated", email: real.userEmail ?? undefined });
    if (real.status !== "unlocked") await keychainDelete("session").catch(() => undefined);
    return real.status === "unlocked" && !(await getSession()) ? "locked" : real.status;
  }
  if (!readState().loggedIn) return "unauthenticated";
  return (await getSession()) ? "unlocked" : "locked";
};

export const requireSession = async (): Promise<string> => {
  const session = await getSession();
  if (!session) throw new Error("Vault is locked");
  return session;
};

export const login = async (clientId: string, clientSecret: string, serverUrl = ""): Promise<void> => {
  const current = await bwJson<{ status: Status; serverUrl?: string | null }>(["status"]);
  if (current.status !== "unauthenticated") await bw(["logout"]).catch(() => undefined);
  const server = serverUrl.trim() || "https://vault.bitwarden.com";
  if ((current.serverUrl ?? "https://vault.bitwarden.com") !== server) await bw(["config", "server", server]);
  await bw(["login", "--apikey"], {
    env: { BW_CLIENTID: clientId.trim(), BW_CLIENTSECRET: clientSecret.trim() },
  });
  const after = await bwJson<{ userEmail?: string }>(["status"]);
  writeState({ loggedIn: true, email: after.userEmail });
  rememberAccount(after.userEmail ?? "", server);
};

/** Unlock with the master password (through env, never argv). */
export const unlock = async (password: string): Promise<string> => {
  const session = await bw(["unlock", "--passwordenv", "BW_PASSWORD", "--raw"], {
    env: { BW_PASSWORD: password },
  });
  await keychainSet("session", session);
  writeState({
    masterHash: hashSecret(password),
    lastUsed: Date.now(),
    pinFails: 0,
    sessionId: randomBytes(8).toString("hex"),
  });
  if (quickUnlockMode() !== "off") await keychainSet("master", password);
  else await keychainDelete("master"); // Off must not leave an older saved master behind
  return session;
};

export const canQuickUnlock = async (): Promise<boolean> => {
  const mode = quickUnlockMode();
  if (mode === "off" || !(await keychainGet("master"))) return false;
  return mode === "touchid" || Boolean(readState().pinHash);
};

const MAX_PIN_FAILS = 5;

/** Touch ID / PIN: proves it's you, then unlocks with the master password kept in the Keychain. */
export const quickUnlock = async (pin = ""): Promise<string> => {
  const mode = quickUnlockMode();
  if (mode === "off") throw new Error("Quick unlock is turned off. Use your master password");
  if (mode === "touchid" && !(await authenticate())) throw new Error("Authentication cancelled");
  if (mode === "pin") {
    const state = readState();
    if (!verifySecret(pin, state.pinHash)) {
      const fails = (state.pinFails ?? 0) + 1;
      writeState({ pinFails: fails });
      if (fails >= MAX_PIN_FAILS) await forgetQuickUnlock();
      throw new Error(fails >= MAX_PIN_FAILS ? "Too many wrong PINs. Use your master password" : "Wrong PIN");
    }
  }
  const master = await keychainGet("master");
  if (!master) throw new Error("Use your master password");
  return unlock(master);
};

export const setPin = (pin: string): void => {
  if (!/^\d{4,12}$/.test(pin)) throw new Error("PIN must be 4–12 digits");
  writeState({ pinHash: hashSecret(pin), pinFails: 0 });
};

export const forgetQuickUnlock = async (): Promise<void> => {
  await keychainDelete("master");
  writeState({ pinHash: undefined, pinFails: 0 });
};

/** Master-password re-prompt check, done locally against the hash saved at unlock. */
export const verifyMaster = (password: string): boolean => verifySecret(password, readState().masterHash);

/**
 * Deleting the Keychain session is what locks the workflow; `bw lock` only tidies up the CLI,
 * so it runs detached and never delays a window (it cost ~0.7 s before the window could open).
 */
export const lock = async (): Promise<void> => {
  const session = await keychainGet("session");
  // The re-prompt verifier and its grace period must not outlive the unlocked session.
  writeState({ masterHash: undefined, repromptedAt: undefined, sessionId: undefined });
  (await import("./vault.ts")).invalidateVault();
  if (session) bwDetached(["lock"], session);
  await keychainDelete("session"); // throws if the key could not be removed
};

export const logout = async (): Promise<void> => {
  await lock();
  await forgetQuickUnlock();
  await bw(["logout"]).catch(() => undefined);
  for (const file of [statePath(), join(cacheDir(), `${perAccount("cache")}.json`)])
    if (existsSync(file)) rmSync(file);
  forgetAccount();
};

// --- account list ---

const rememberAccount = (email: string, server: string): void => {
  const accounts = readAccounts();
  const id = accountId();
  writeAccounts({
    ...accounts,
    active: id,
    list: [...accounts.list.filter((a) => a.id !== id), { id, email, server }],
  });
};

const forgetAccount = (): void => {
  const gone = accountId();
  const list = readAccounts().list.filter((a) => a.id !== gone);
  // Fall back to any remaining login, including the original (un-listed) one.
  const next = allAccounts().find((a) => a.id !== gone)?.id ?? DEFAULT_ACCOUNT;
  writeAccounts({ active: next, list });
};

/** A fresh slot for another login; the window then shows the login sheet. */
export const addAccount = (): void => {
  const accounts = readAccounts();
  writeAccounts({ ...accounts, active: randomBytes(4).toString("hex") });
};

/** Switching locks the account you switch to, so it asks for Touch ID / PIN / password first. */
export const switchAccount = async (id: string): Promise<void> => {
  const accounts = readAccounts();
  if (!allAccounts().some((a) => a.id === id) || id === accounts.active) return;
  writeAccounts({ ...accounts, active: id });
  await lock();
};

/**
 * Saved accounts, including the original login from before account tracking existed
 * (it lives in the un-suffixed default paths and was never written to accounts.json).
 */
export const allAccounts = (): Account[] => {
  const { list } = readAccounts();
  if (list.some((a) => a.id === DEFAULT_ACCOUNT)) return list;
  try {
    const legacy = JSON.parse(readFileSync(join(dataDir(), "state.json"), "utf8")) as State;
    return legacy.loggedIn
      ? [{ id: DEFAULT_ACCOUNT, email: legacy.email ?? "First account", server: "" }, ...list]
      : list;
  } catch {
    return list;
  }
};
