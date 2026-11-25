import { run } from "./proc.ts";

/** Browsers that expose the current tab over AppleScript, and the property to read. */
const WEBKIT = ["Safari", "Safari Technology Preview", "Orion"];
const CHROMIUM = [
  "Google Chrome",
  "Google Chrome Canary",
  "Chromium",
  "Arc",
  "Brave Browser",
  "Microsoft Edge",
  "Vivaldi",
  "Opera",
  "Comet",
  "Dia",
  "Helium",
];

/** Firefox and its forks have no AppleScript tab access; their address bar is read through Accessibility. */
const GECKO = [
  "Firefox",
  "Firefox Developer Edition",
  "Firefox Nightly",
  "Zen",
  "Floorp",
  "LibreWolf",
  "Waterfox",
  "Mullvad Browser",
];

/**
 * Walks groups and toolbars of the front window to the first combo box: the address bar.
 * It needs the Accessibility permission Alfred already has for autofill. ~0.6 s, which is fine
 * because the site lookup runs after the window has opened.
 */
const geckoScript = (app: string): string => `
const find = (el, depth) => {
  if (depth > 8) return "";
  let roles = [];
  try { roles = el.uiElements.role(); } catch (e) { return ""; }
  const i = roles.indexOf("AXComboBox");
  if (i >= 0) { try { return String(el.uiElements[i].value() || ""); } catch (e) { return ""; } }
  for (let j = 0; j < roles.length; j++) {
    if (roles[j] !== "AXGroup" && roles[j] !== "AXToolbar") continue;
    const found = find(el.uiElements[j], depth + 1);
    if (found) return found;
  }
  return "";
};
find(Application("System Events").processes.byName(${JSON.stringify(app)}).windows[0], 0);`;

/** The address bar hides the scheme (`example.com/path`); anything that isn't a host is not a URL. */
export const addressBarUrl = (value: string): string => {
  const text = value.trim();
  if (/^https?:\/\//i.test(text)) return text;
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/\S*)?$/i.test(text) ? `https://${text}` : "";
};

const frontAppScript = `ObjC.import("AppKit"); $.NSWorkspace.sharedWorkspace.frontmostApplication.localizedName.js`;

const tabScript = (app: string): string | undefined => {
  if (WEBKIT.includes(app)) return `tell application "${app}" to return URL of front document`;
  if (CHROMIUM.includes(app)) return `tell application "${app}" to return URL of active tab of front window`;
  return undefined;
};

export const frontmostApp = async (): Promise<string> =>
  (await run("/usr/bin/osascript", ["-l", "JavaScript", "-e", frontAppScript])).stdout.trim();

/**
 * URL of the front browser tab, or "" for non-browsers.
 * Alfred passes the app that was in front as `focusedapp` when the hotkey asks for it.
 */
export const currentTabUrl = async (appName?: string): Promise<string> => {
  const app = appName || (await frontmostApp());
  if (GECKO.includes(app)) {
    const { code, stdout } = await run("/usr/bin/osascript", ["-l", "JavaScript", "-e", geckoScript(app)], {
      timeoutMs: 1500,
    });
    return code === 0 ? addressBarUrl(stdout) : "";
  }
  const script = tabScript(app);
  if (!script) return "";
  const { code, stdout } = await run("/usr/bin/osascript", ["-e", script], { timeoutMs: 1200 });
  return code === 0 ? stdout.trim() : "";
};
