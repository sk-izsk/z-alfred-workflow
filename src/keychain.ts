import { BUNDLE_ID, perAccount } from "./env.ts";
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
  return code === 0 ? decodeSecret(stdout.replace(/\n$/, "")) : undefined;
};

export const keychainSet = async (account: KeychainAccount, secret: string): Promise<void> => {
  const command = `add-generic-password -U -s ${quote(BUNDLE_ID)} -a ${quote(entry(account))} -w ${quote(encodeSecret(secret))}\n`;
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
