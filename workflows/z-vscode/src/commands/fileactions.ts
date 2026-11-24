import { statSync } from "node:fs";
import { dirname } from "node:path";
import { str } from "../env.ts";
import { remoteUrl, webUrl } from "../git.ts";
import { alfredSearch, closeWindows, openInTerminal, openPath, openUrl, revealInFinder } from "../launch.ts";

/**
 * Universal Actions (→ on any file or folder in Alfred) and the `codef` modifier keys.
 * Each prints a line for the notification (empty = none).
 */
const dirOf = (path: string): string => {
  try {
    return statSync(path).isDirectory() ? path : dirname(path);
  } catch {
    return dirname(path);
  }
};

const menu = () => str("kw_main", "code");

const ACTIONS: Record<string, (path: string) => Promise<string>> = {
  "close-others": async (path) => {
    await closeWindows();
    await openPath(path);
    return "";
  },
  terminal: async (path) => (await openInTerminal(dirOf(path)), ""),
  reveal: async (path) => (await revealInFinder(path), ""),
  github: async (path) => {
    const url = webUrl(remoteUrl(dirOf(path)));
    if (!url) return "Not a git repository with an origin remote";
    await openUrl(url);
    return "";
  },
  // Pickers reopen the `code` menu on a list of editors / profiles for this path.
  "pick-editor": async (path) => (await alfredSearch(`${menu()} open-in ${path}`), ""),
  "pick-profile": async (path) => (await alfredSearch(`${menu()} open-profile ${path}`), ""),
};

export const fileAction = async ([action = "", path = ""]: string[]): Promise<void> => {
  const run = ACTIONS[action];
  if (!run) throw new Error(`Unknown action: ${action}`);
  // Universal Actions can pass several files separated by tabs; act on the first.
  process.stdout.write(await run(path.split("\t")[0] ?? ""));
};
