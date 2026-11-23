import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { accountId, BUNDLE_ID, perAccountId } from "./env.ts";

/**
 * The key that encrypts the item-name cache: 32 random bytes in the login Keychain, one per account.
 * Synchronous, because the cache is read from many sync code paths. It is added through
 * `security -i` on stdin, never as an argument, so it cannot show up in `ps`.
 * No key (Keychain unavailable) means no cache: the file is never written unencrypted.
 */
const known = new Map<string, Buffer>();
const entry = (account: string): string => perAccountId("cachekey", account);

const security = (args: string[], input?: string) =>
  spawnSync("/usr/bin/security", args, {
    encoding: "utf8",
    input,
    env: { PATH: "/usr/bin:/bin", HOME: process.env.HOME ?? "" },
    timeout: 5000,
  });

export const cacheKey = (account: string = accountId()): Buffer | undefined => {
  const name = entry(account);
  const hit = known.get(name);
  if (hit) return hit;
  const found = security(["find-generic-password", "-s", BUNDLE_ID, "-a", name, "-w"]);
  let hex = found.status === 0 ? found.stdout.trim() : "";
  if (!/^[0-9a-f]{64}$/.test(hex)) {
    hex = randomBytes(32).toString("hex");
    const added = security(["-i"], `add-generic-password -U -s "${BUNDLE_ID}" -a "${name}" -w "${hex}"\n`);
    if (added.status !== 0 || /error/i.test(added.stderr)) return undefined;
  }
  const key = Buffer.from(hex, "hex");
  known.set(name, key);
  return key;
};

/** Remove this account's key (logout), which also makes any leftover cache file unreadable. */
export const forgetCacheKey = (account: string = accountId()): void => {
  known.delete(entry(account));
  security(["delete-generic-password", "-s", BUNDLE_ID, "-a", entry(account)]);
};
