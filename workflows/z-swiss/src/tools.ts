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
    id: "gif-search",
    name: "GIF Search",
    description: "GIF search, favorites and recents in list or grid views",
    bundle: "com.izsk.gif-search",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "gifsearch",
  },
  {
    id: "shortcuts",
    name: "Shortcuts",
    description: "Search, run and edit your macOS Shortcuts, with text or files as input",
    bundle: "com.izsk.shortcuts",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "shortcuts",
  },
  {
    id: "sound",
    name: "Sound",
    description: "Choose the sound output or input device, with volume and alert sounds",
    bundle: "com.izsk.sound",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "sound",
  },
  {
    id: "displays",
    name: "Displays",
    description: "Display resolution and refresh rate, main display, mirroring and Dark Mode",
    bundle: "com.izsk.displays",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "displays",
  },
  {
    id: "drives",
    name: "Drives",
    description: "Mounted drives and disk images with free space, and eject",
    bundle: "com.izsk.drives",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "drives",
  },
  {
    id: "background",
    name: "Background Items",
    description: "Login items, launch agents and daemons: see, stop, disable",
    bundle: "com.izsk.background",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "bgitems",
  },
  {
    id: "menubar",
    name: "Menu Bar",
    description: "Search and click the menu items of the app you are using",
    bundle: "com.izsk.menubar",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "m",
  },
  {
    id: "camera",
    name: "Camera",
    description: "A quick look at your camera before a meeting, in a corner of the screen",
    bundle: "com.izsk.camera",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "cam",
  },
  {
    id: "window-navigator",
    name: "Window Navigator",
    description: "Find windows across desktops, active app or current desktop · wins shortcut",
    bundle: "com.izsk.window-navigator",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "wnav",
  },

  {
    id: "lunar",
    name: "Lunar Controls",
    description: "Display brightness, contrast, volume, inputs and Lunar presets",
    bundle: "com.izsk.lunar",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "lunarui",
  },

  {
    id: "emoji",
    name: "Emoji Picker",
    description: "Offline emoji search, favorites, recents and skin-tone variants",
    bundle: "com.izsk.emoji",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "emoji",
  },

  {
    id: "mole",
    name: "Mole",
    description: "Mole health, disk browsing and reviewed cleanup/optimization previews",
    bundle: "com.izsk.mole",
    trigger: "open",
    minimum: "0.1.0",
    keyword: "moleui",
  },

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
  } catch {
    // no custom Alfred preferences folder: use the default
  }
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
      } catch {
        // unreadable workflow folder: skip it
      }
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
