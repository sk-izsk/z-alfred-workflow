import { existsSync } from "node:fs";
import { EDITORS, type Editor, appPath, cliPath, editor } from "./editors.ts";
import { str } from "./env.ts";
import { exec, osascript, run } from "./proc.ts";
import type { Project } from "./projects.ts";

const OPEN = "/usr/bin/open";

/** Closes every window of the editor first (System Events, needs Accessibility for Alfred). */
export const closeWindows = async (): Promise<void> => {
  const name = editor().app.replace(/\.app$/, "");
  await osascript(
    `tell application "System Events"
       if not (exists process (item 1 of argv)) then return
       tell process (item 1 of argv)
         repeat while window 1 exists
           click button 1 of window 1
         end repeat
       end tell
     end tell`,
    name,
  ).catch(() => undefined); // ponytail: no Accessibility permission → just open alongside
};

/** Open a project. Remote entries need the CLI; local ones go through `open -a` (works for every editor). */
export const openProject = async (p: Project, closeOthers = false): Promise<void> => {
  if (closeOthers) await closeWindows();
  if (p.remote) {
    const flag = p.uri.endsWith(".code-workspace") ? "--file-uri" : "--folder-uri";
    await exec(cliPath(), ["--new-window", flag, p.uri]);
    return;
  }
  await openPath(p.path);
};

export const openPath = (path: string): Promise<string> => exec(OPEN, ["-a", appPath(), path]);

export const newWindow = async (): Promise<void> => {
  const e = editor();
  if (e.kind === "zed") await exec(cliPath(), ["--new"]);
  else await exec(cliPath(), ["--new-window"]);
};

export const agentsWindow = (): Promise<string> => exec(cliPath(), ["--agents"]);

export const revealInFinder = (path: string): Promise<string> => exec(OPEN, ["-R", path]);

/** Terminal app from the Workflow Configuration (Terminal by default). */
export const openInTerminal = (dir: string): Promise<string> =>
  exec(OPEN, ["-a", str("terminal_app", "Terminal"), dir]);

/** Alfred's own File Actions panel for a path (Open With…, Move, Copy, AirDrop, …). */
export const alfredActions = (path: string): Promise<string> =>
  osascript(`tell application id "com.runningwithcrayons.Alfred" to action {item 1 of argv}`, path);

/** Reopen the `code` menu (after ⌘[ in a window). */
export const alfredSearch = (text: string): Promise<string> =>
  osascript(`tell application id "com.runningwithcrayons.Alfred" to search (item 1 of argv)`, text);

export const editorInstalled = (): boolean => existsSync(appPath());

export const openUrl = (url: string) => run(OPEN, [url]);

/** Open a local path in another installed editor (the ⌘K "Open in ▸" submenu). */
export const openPathIn = (e: Editor, path: string): Promise<string> => exec(OPEN, ["-a", appPath(e), path]);

/** Open a path in a new window using a VS Code profile. */
export const openWithProfile = (profileName: string, path?: string): Promise<string> =>
  exec(cliPath(), [
    ...(profileName === "Default" ? [] : ["--profile", profileName]),
    "--new-window",
    ...(path ? [path] : []),
  ]);

/** Editors from the list that are actually installed. */
export const installedEditors = (): Editor[] => EDITORS.filter((e) => existsSync(appPath(e)));

/**
 * Run a Command Palette command: bring the editor forward, ⇧⌘P, type, ↩. VS Code has no CLI for
 * things like Settings Sync. Needs Accessibility permission for Alfred (System Events keystrokes).
 */
export const runPaletteCommand = (command: string): Promise<string> =>
  osascript(
    `tell application (item 1 of argv) to activate
     delay 0.6
     tell application "System Events"
       keystroke "p" using {command down, shift down}
       delay 0.35
       keystroke (item 2 of argv)
       delay 0.6
       key code 36
     end tell`,
    appPath(),
    command,
  );

export const clipboard = async (): Promise<string> => (await run("/usr/bin/pbpaste", [])).stdout.trim();
