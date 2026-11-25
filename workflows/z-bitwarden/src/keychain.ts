import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openCache, sealCache } from "./cachecrypt.ts";
import { BUNDLE_ID, dataDir, perAccount } from "./env.ts";
import { run } from "./proc.ts";

/**
 * Secrets live in the login Keychain under service `com.izsk.bitwarden`.
 * `security -i` reads its command from stdin, so the secret never shows up in `ps`.
 */
const quote = (value: string) => `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;

/**
 * `security find-generic-password -w` answers in hex when the value has any non-printable-ASCII byte
 * (accents, a newline, a tab). So secrets are stored base64-encoded, which is always plain ASCII.
 * Values saved by older versions have no prefix and are returned as they are.
 */
const B64 = "b64:";
export const encodeSecret = (secret: string): string => B64 + Buffer.from(secret, "utf8").toString("base64");
export const decodeSecret = (stored: string): string =>
  stored.startsWith(B64) ? Buffer.from(stored.slice(B64.length), "base64").toString("utf8") : stored;

/**
 * Split key: what goes into the Keychain is AES-256-GCM ciphertext, and its key is a separate
 * `0600` file in the workflow data folder. A one-line `security find-generic-password` or a
 * Keychain dump then yields nothing usable; an attacker needs both pieces, and has to know this
 * workflow to look for the second. It does not stop malware that targets this workflow.
 */
const SEALED = "s1:";
const wrapKeyPath = () => join(dataDir(), "keychain.key");

/** The wrapping key, created on first write. `create: false` never makes one (reads fail closed). */
export const wrapKey = (create: boolean, path = wrapKeyPath()): Buffer | undefined => {
  try {
    const key = readFileSync(path);
    if (key.length === 32) return key;
  } catch {
    // missing: fall through
  }
  if (!create) return undefined;
  try {
    writeFileSync(path, randomBytes(32), { mode: 0o600, flag: "wx" }); // wx: never replace a key another process just made
  } catch {
    // lost a race with another process, or the folder is unwritable; read what is there
  }
  const key = readFileSync(path);
  if (key.length === 32) return key;
  // A damaged key file can't open anything sealed with it anyway; replace it rather than lock you out.
  const fresh = randomBytes(32);
  writeFileSync(path, fresh, { mode: 0o600 });
  return fresh;
};

export const sealSecret = (secret: string, key: Buffer): string =>
  SEALED + sealCache(secret, key).toString("base64");

/** The secret, or undefined for a wrong or missing key or a modified value (treated as locked). */
export const openSecret = (stored: string, key: Buffer | undefined): string | undefined =>
  key ? openCache(Buffer.from(stored.slice(SEALED.length), "base64"), key) : undefined;

/** Entry names are per Bitwarden account: `session`, `master`, `session-<id>`… */
export type KeychainAccount = "session" | "master";
const entry = (account: KeychainAccount) => perAccount(account);

export const keychainGet = async (account: KeychainAccount): Promise<string | undefined> => {
  const { code, stdout } = await run("/usr/bin/security", [
    "find-generic-password",
    "-s",
    BUNDLE_ID,
    "-a",
    entry(account),
    "-w",
  ]);
  if (code !== 0) return undefined;
  const stored = stdout.replace(/\n$/, "");
  // Values from before the split key are still read; the next unlock stores them sealed.
  return stored.startsWith(SEALED) ? openSecret(stored, wrapKey(false)) : decodeSecret(stored);
};

export const keychainSet = async (account: KeychainAccount, secret: string): Promise<void> => {
  const key = wrapKey(true);
  if (!key) throw new Error("Could not create the Keychain wrapping key");
  const command = `add-generic-password -U -s ${quote(BUNDLE_ID)} -a ${quote(entry(account))} -w ${quote(sealSecret(secret, key))}\n`;
  const { code, stderr } = await run("/usr/bin/security", ["-i"], { input: command });
  if (code !== 0 || /error/i.test(stderr)) throw new Error(`Keychain write failed: ${stderr.trim()}`);
};

export const keychainDelete = async (account: KeychainAccount): Promise<void> => {
  const { code } = await run("/usr/bin/security", [
    "delete-generic-password",
    "-s",
    BUNDLE_ID,
    "-a",
    entry(account),
  ]);
  // security maps errSecItemNotFound (-25300) to exit status 44.
  if (code !== 0 && code !== 44) throw new Error("Could not remove the saved Keychain credential");
};
