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
    id: "system-monitor",
    name: "System Monitor",
    description: "Live CPU, memory, disks, power and network details",
    bundle: "com.izsk.system-monitor",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "sysmon",
  },

  {
    id: "tag-manager",
    name: "Tag Manager",
    description: "Find and manage Finder tags on files, folders and apps",
    bundle: "com.izsk.tag-manager",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "tags",
  },

  {
    id: "folder-navigator",
    name: "Folder Navigator",
    description: "Find folders and browse files with complete Back history",
    bundle: "com.izsk.folder-navigator",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "folders",
  },

  {
    id: "translate",
    name: "Translate",
    description: "Clipboard and text translation with native split panes",
    bundle: "com.izsk.translate",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "translate",
  },

  {
    id: "workflow-manager",
    name: "Workflow Manager",
    description: "Installed workflows, Gallery, updates and configuration",
    bundle: "com.izsk.workflow-manager",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "wfman",
  },
  {
    id: "world-clock",
    name: "World Clock",
    description: "Search timezones, star locations and compare world times",
    bundle: "com.izsk.world-clock",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "wclock",
  },
  {
    id: "speedtest",
    name: "Speed Test",
    description: "Measure download, upload and latency",
    bundle: "com.izsk.speedtest",
    trigger: "speedtest",
    minimum: "0.1.3",
    keyword: "speedtest",
  },
  {
    id: "kill",
    name: "Kill Process",
    description: "Find processes, CPU/RAM and terminate apps",
    bundle: "com.izsk.kill-process",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "kill",
  },
  {
    id: "weather",
    name: "Weather",
    description: "Saved cities, forecasts and air quality",
    bundle: "com.izsk.weather",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "weather",
  },
  {
    id: "adhan",
    name: "Adhan Time",
    description: "Prayer calendar and next-prayer countdown",
    bundle: "com.izsk.adhan-time",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "adhan",
  },
  {
    id: "currency",
    name: "Currency Exchange",
    description: "Calculate amounts, cross-rates and favorites",
    bundle: "com.izsk.currency",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "currency",
  },
  {
    id: "calculator",
    name: "Calculate Anything",
    description: "Units, percentages, storage, time and arithmetic",
    bundle: "com.izsk.calculate-anything",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "calcany",
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
  if (!/^[a-f0-9-]{36}$/.test(returnTo)) throw new Error("Invalid Swiss session.");
  return "swiss:v1:" + Buffer.from(JSON.stringify({ returnTo, query })).toString("base64url");
};
