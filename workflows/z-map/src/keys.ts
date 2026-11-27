// Google and HERE API keys live in one Keychain item (JSON), never in Alfred's preferences.
import { execFileSync } from "node:child_process";
import { BUNDLE_ID } from "./env.ts";

export type KeyName = "google" | "here";
export type Keys = Partial<Record<KeyName, string>>;
const ACCOUNT = "api-keys";

let cache: Keys | undefined;
/** Tests set keys directly instead of touching the Keychain. */
export const useKeys = (keys: Keys): void => {
  cache = keys;
};

export const readKeys = (): Keys => {
  if (cache) return cache;
  try {
    const raw = execFileSync(
      "/usr/bin/security",
      ["find-generic-password", "-s", BUNDLE_ID, "-a", ACCOUNT, "-w"],
      { encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
    cache = JSON.parse(Buffer.from(raw.replace(/^b64:/, ""), "base64").toString("utf8")) as Keys;
  } catch {
    cache = {};
  }
  return cache;
};

/** `security -i` reads the command from stdin, so the key never shows up in `ps`. */
const write = (keys: Keys): void => {
  const encoded = `b64:${Buffer.from(JSON.stringify(keys), "utf8").toString("base64")}`;
  execFileSync("/usr/bin/security", ["-i"], {
    input: `add-generic-password -U -s "${BUNDLE_ID}" -a "${ACCOUNT}" -w "${encoded}"\n`,
    timeout: 5000,
    stdio: ["pipe", "ignore", "ignore"],
  });
  cache = keys;
};

export const saveKey = (name: KeyName, value: string): void => write({ ...readKeys(), [name]: value.trim() });

export const removeKey = (name: KeyName): void => {
  const { [name]: _gone, ...rest } = readKeys();
  if (Object.keys(rest).length) write(rest);
  else {
    try {
      execFileSync("/usr/bin/security", ["delete-generic-password", "-s", BUNDLE_ID, "-a", ACCOUNT], {
        stdio: "ignore",
      });
    } catch {
      // already gone
    }
    cache = {};
  }
};
