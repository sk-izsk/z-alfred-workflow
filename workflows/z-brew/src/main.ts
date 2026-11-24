import { existsSync } from "node:fs";
import * as actions from "./commands.ts";
import { executable, readBrew } from "./brew.ts";
import { str } from "./env.ts";
import { packageName } from "./model.ts";
import { terminalCommand, type Plan } from "./operations.ts";
import { exec, osascript } from "./proc.ts";
import { rootItems } from "./root.ts";
import { errorStatus, print, type Action } from "./ui.ts";

const post = async (): Promise<void> => {
  const out = process.env.brew_out;
  if (out === "back")
    await osascript(
      'tell application id "com.runningwithcrayons.Alfred" to search (item 1 of argv)',
      `${str("kw_main", "brew")} `,
    );
  if (out === "execute") {
    const command = terminalCommand(executable(), JSON.parse(process.env.brew_execution || "null") as Plan);
    if (str("terminal_app", "Terminal") === "iTerm")
      await osascript(
        'tell application "iTerm"\nactivate\nif (count of windows) = 0 then create window with default profile\ntell current session of current window to write text (item 1 of argv)\nend tell',
        command,
      );
    else
      await osascript('tell application "Terminal"\nactivate\ndo script (item 1 of argv)\nend tell', command);
  }
  if (out === "finder") {
    const [kind, ...parts] = (process.env.brew_package || "").split(":");
    if (kind !== "formula" && kind !== "cask") throw new Error("Invalid package type.");
    const token = packageName(parts.join(":"));
    const result = await readBrew([kind === "formula" ? "--prefix" : "--caskroom", token]);
    const path = result.stdout.trim();
    if (result.code || !path.startsWith("/") || !existsSync(path))
      throw new Error("No installed package folder was found.");
    await exec("/usr/bin/open", ["-R", path]);
  }
};
const handlers: Record<string, (args: string[]) => Promise<Action>> = {
  load: actions.load,
  filter: actions.filter,
  selected: actions.selectedPackage,
  hydrate: actions.hydrate,
  action: actions.action,
  preview: actions.preview,
  plan: actions.planAction,
  execute: actions.execute,
  "add-tap": actions.addTap,
  "report-copy": actions.reportCopy,
  "report-menu": actions.reportMenu,
  "clear-cache": actions.clearCache,
  "maintenance-action": actions.maintenanceAction,
};
const [command = "", ...args] = process.argv.slice(2);
if (command === "root") process.stdout.write(JSON.stringify({ items: rootItems(args[0] || "") }));
else if (command === "post") {
  try {
    await post();
  } catch (error) {
    process.stdout.write(error instanceof Error ? error.message : String(error));
  }
} else if (handlers[command]) print(await handlers[command]!(args).catch(errorStatus));
else {
  print(errorStatus(new Error("Unknown Brew command.")));
  process.exitCode = 1;
}
