import { existsSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
export type Tool = {
  id: string;
  name: string;
  description: string;
  bundle: string;
  trigger: string;
  minimum: string;
  keyword: string;
};
export const tools: Tool[] = [
  {
    id: "dev-servers",
    name: "Dev Servers",
    description: "Local development servers, project grouping and stop/restart",
    bundle: "com.izsk.dev-servers",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "devservers",
  },
  {
    id: "bluetooth",
    name: "Bluetooth",
    description: "Connect and disconnect Bluetooth devices",
    bundle: "com.izsk.bluetooth",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "bluetooth",
  },
  {
    id: "wifi",
    name: "Wi-Fi",
    description: "Wi-Fi status, networks and connection controls",
    bundle: "com.izsk.wifi",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "wifi",
  },
  {
    id: "dev-cache-cleaner",
    name: "Dev Cache Cleaner",
    description: "Inspect developer caches and review cleanup",
    bundle: "com.izsk.dev-cache-cleaner",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "devcache",
  },
  {
    id: "dev-utils",
    name: "Dev Utils",
    description: "Developer and text transformations",
    bundle: "com.izsk.dev-utils",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "devutils",
  },
];
export type Installed = { bundle: string; version: string };
export const installed = (): Installed[] => {
  let sync = "";
  try {
    sync = execFileSync(
      "/usr/bin/defaults",
      ["read", "com.runningwithcrayons.Alfred-Preferences", "syncfolder"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    )
      .trim()
      .replace(/^~(?=\/)/, homedir());
  } catch {}
  const roots = [
      sync ? join(sync, "Alfred.alfredpreferences/workflows") : "",
      join(homedir(), "Library/Application Support/Alfred/Alfred.alfredpreferences/workflows"),
    ],
    found: Installed[] = [];
  for (const root of roots) {
    if (!root || !existsSync(root)) continue;
    for (const entry of readdirSync(root)) {
      try {
        const info = JSON.parse(
          execFileSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", join(root, entry, "info.plist")], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
          }),
        );
        if (tools.some((t) => t.bundle === info.bundleid))
          found.push({ bundle: info.bundleid, version: String(info.version || "0") });
      } catch {}
    }
  }
  return found;
};
export const available = (tool: Tool, all: Installed[]): boolean =>
  all.some(
    (item) =>
      item.bundle === tool.bundle &&
      tool.minimum
        .split(".")
        .map(Number)
        .every((n, i, parts) => {
          const actual = item.version.split(".").map(Number);
          for (let k = 0; k < i; k++) if ((actual[k] || 0) !== parts[k]) return (actual[k] || 0) > parts[k]!;
          return (actual[i] || 0) >= n;
        }),
  );
export const envelope = (returnTo: string, query = ""): string => {
  if (!/^[a-f0-9-]{36}$/.test(returnTo)) throw new Error("Invalid Dev session.");
  return "dev:v1:" + Buffer.from(JSON.stringify({ returnTo, query })).toString("base64url");
};
