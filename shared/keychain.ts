// API keys and other secrets in the macOS Keychain, shared by the workflows (bundled into each).
// Rules (see AGENTS.md): never in Alfred preferences, argv, logs, cache or state files. A key typed
// into a window reaches the script as a UI script environment variable and is written to the
// Keychain through `security -i` on stdin, so it never appears in `ps`.
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const SECURITY = "/usr/bin/security";
const cache = new Map<string, string>();

/** One Keychain item per secret: service = the workflow's bundle ID, account = the secret's name. */
export const keychain = (service: string) => {
  const read = (account: string): string => {
    const key = `${service}/${account}`;
    if (cache.has(key)) return cache.get(key)!;
    let value = "";
    try {
      const raw = execFileSync(SECURITY, ["find-generic-password", "-s", service, "-a", account, "-w"], {
        encoding: "utf8",
        timeout: 5000,
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
      value = raw.startsWith("b64:") ? Buffer.from(raw.slice(4), "base64").toString("utf8") : raw;
    } catch {
      // no item yet
    }
    cache.set(key, value);
    return value;
  };

  const save = (account: string, value: string): void => {
    const secret = value.trim();
    if (!secret) throw new Error("Paste a key first.");
    // Base64 keeps quotes and spaces in the secret from breaking the `security -i` command line.
    const encoded = `b64:${Buffer.from(secret, "utf8").toString("base64")}`;
    execFileSync(SECURITY, ["-i"], {
      input: `add-generic-password -U -s "${service}" -a "${account}" -w "${encoded}"\n`,
      timeout: 5000,
      stdio: ["pipe", "ignore", "ignore"],
    });
    cache.set(`${service}/${account}`, secret);
  };

  const remove = (account: string): void => {
    try {
      execFileSync(SECURITY, ["delete-generic-password", "-s", service, "-a", account], { stdio: "ignore" });
    } catch {
      // already gone
    }
    cache.set(`${service}/${account}`, "");
  };

  /**
   * Moves a key that older versions kept in Workflow Configuration into the Keychain and deletes
   * it from prefs.plist. `legacy` is the configuration value (may be empty).
   */
  const migrate = (account: string, legacy: string, workflowDir: string, variable: string): void => {
    if (!legacy.trim()) return;
    if (!read(account)) save(account, legacy);
    try {
      execFileSync("/usr/bin/plutil", ["-remove", variable, join(workflowDir, "prefs.plist")], {
        stdio: "ignore",
      });
    } catch {
      // not in prefs.plist (e.g. set as an environment variable)
    }
  };

  return { read, save, remove, migrate };
};
