import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";
import { exec } from "./proc.ts";
import { str, dataDir, cacheDir } from "./env.ts";
import { calculate } from "./expression.ts";
export type Result = {
  uid: string;
  title: string;
  subtitle: string;
  value: string;
  raw: string;
  single: string;
};
const plist = (path: string): Record<string, any> => {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(
      execFileSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", path], { encoding: "utf8" }),
    );
  } catch {
    return {};
  }
};
const engineBundle = "com.alfred.calculateanything";
const valid = (path: string) =>
  plist(join(path, "info.plist")).bundleid === engineBundle && existsSync(join(path, "process.php"));
export const enginePath = (): string => {
  const configured = str("engine_path");
  if (configured) {
    const path = resolve(configured.replace(/^~(?=\/)/, homedir()));
    if (valid(path)) return path;
    throw new Error("Selected folder is not Calculate Anything.");
  }
  let sync = "";
  try {
    sync = execFileSync(
      "/usr/bin/defaults",
      ["read", "com.runningwithcrayons.Alfred-Preferences", "syncfolder"],
      { encoding: "utf8" },
    )
      .trim()
      .replace(/^~(?=\/)/, homedir());
  } catch {}
  const roots = [
    sync ? join(sync, "Alfred.alfredpreferences/workflows") : "",
    join(homedir(), "Library/Application Support/Alfred/Alfred.alfredpreferences/workflows"),
  ];
  for (const root of roots) {
    if (!root || !existsSync(root)) continue;
    for (const entry of readdirSync(root)) {
      const path = join(root, entry);
      if (valid(path)) return path;
    }
  }
  throw new Error(
    "Install Calculate Anything by biati digital, or select its folder in Workflow Configuration.",
  );
};
export const normalize = (items: unknown): Result[] => {
  if (!Array.isArray(items)) return [];
  return items.flatMap((item, i) => {
    if (!item || typeof item !== "object" || item.valid === false) return [];
    const arg = typeof item.arg === "string" || typeof item.arg === "number" ? String(item.arg) : "";
    if (!arg) return [];
    const variant = (key: string) => {
      const value = item.mods?.[key]?.arg;
      return typeof value === "string" || typeof value === "number" ? String(value) : arg;
    };
    return [
      {
        uid: String(i),
        title: String(item.title || arg),
        subtitle: String(item.subtitle || ""),
        value: arg,
        raw: variant("cmd"),
        single: variant("alt"),
      },
    ];
  });
};
export const results = async (query: string): Promise<Result[]> => {
  if (query.length > 500) throw new Error("Query is too long.");
  if (!query.trim()) return [];
  if (/^[\d\s.()+*/^-]+$/.test(query)) {
    const value = String(calculate(query));
    return [
      {
        uid: "math",
        title: value,
        subtitle: "Arithmetic · copied without formatting",
        value,
        raw: value,
        single: value,
      },
    ];
  }
  const path = enginePath();
  if (!existsSync(join(path, "vendor/autoload.php")))
    throw new Error(
      "Calculate Anything is missing vendor files. Reinstall its official release; nothing is installed automatically.",
    );
  const info = plist(join(path, "info.plist")),
    prefs = plist(join(path, "prefs.plist"));
  const defaults = Object.fromEntries(
    (info.userconfigurationconfig || []).map((c: any) => [c.variable, String(c.config?.default ?? "")]),
  );
  const config = Object.fromEntries(
    Object.entries({ ...defaults, ...info.variables, ...prefs }).map(([key, value]) => [key, String(value)]),
  );
  const php = [str("php_path"), "/opt/homebrew/bin/php", "/usr/local/bin/php", "/usr/bin/php"].find(
    (p) => p && existsSync(p),
  );
  if (!php)
    throw new Error(
      "PHP is required by Calculate Anything. Set its installed executable in Workflow Configuration.",
    );
  const source =
    '$input=json_decode(stream_get_contents(STDIN),true); $query=$input["query"]; $action=$input["action"]; include $input["path"];';
  const action = /^vat\s/i.test(query)
    ? "vat"
    : /^time\s/i.test(query)
      ? "time"
      : /^color\s/i.test(query)
        ? "color"
        : "";
  const input = JSON.stringify({
    query: query.replace(/^(?:vat|time|color)\s+/i, ""),
    action,
    path: join(path, "process.php"),
  });
  let output: string;
  try {
    output = await exec(php, ["-d", "display_errors=stderr", "-r", source], {
      cwd: path,
      input,
      timeoutMs: 12000,
      env: {
        ...process.env,
        ...config,
        PWD: path,
        alfred_version: "6",
        alfred_debug: "",
        alfred_workflow_bundleid: engineBundle,
        alfred_workflow_data: join(dataDir(), "engine"),
        alfred_workflow_cache: cacheDir(),
      },
    });
  } catch {
    throw new Error(
      "Calculate Anything could not complete this query. Check its installation and PHP compatibility.",
    );
  }
  if (output.length > 1e6) throw new Error("Calculator returned too much data.");
  let parsed: any;
  try {
    parsed = JSON.parse(output);
  } catch {
    throw new Error("Calculate Anything returned an unsupported result.");
  }
  return normalize(parsed.items);
};
