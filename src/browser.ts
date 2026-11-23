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

const frontAppScript = `ObjC.import("AppKit"); $.NSWorkspace.sharedWorkspace.frontmostApplication.localizedName.js`;

const tabScript = (app: string): string | undefined => {
  if (WEBKIT.includes(app)) return `tell application "${app}" to return URL of front document`;
  if (CHROMIUM.includes(app)) return `tell application "${app}" to return URL of active tab of front window`;
  return undefined;
};

export const frontmostApp = async (): Promise<string> =>
  (await run("/usr/bin/osascript", ["-l", "JavaScript", "-e", frontAppScript])).stdout.trim();

/**
 * URL of the front browser tab, or "" (Firefox and non-browsers have no AppleScript tab access).
 * Alfred passes the app that was in front as `focusedapp` when the hotkey asks for it.
 */
export const currentTabUrl = async (appName?: string): Promise<string> => {
  const app = appName || (await frontmostApp());
  const script = tabScript(app);
  if (!script) return "";
  const { code, stdout } = await run("/usr/bin/osascript", ["-e", script], { timeoutMs: 1200 });
  return code === 0 ? stdout.trim() : "";
};
