import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { isAbsolute } from "node:path";
import { statSync } from "node:fs";
const execute = promisify(execFile);
type Settings = { str: (key: string, fallback?: string) => string };
type Request = { command?: string; cwd?: string };
export const terminalConfiguration = (defaultApp = "Ghostty") => [
  {
    type: "popupbutton",
    variable: "terminal_app",
    label: "Terminal application",
    description:
      "Used for terminal commands and Open Terminal Here. Install the selected terminal separately.",
    config: {
      default: defaultApp,
      pairs: [
        ["Ghostty", "Ghostty"],
        ["Terminal", "Terminal"],
        ["iTerm2", "iTerm"],
        ["kitty", "kitty"],
        ["WezTerm", "WezTerm"],
        ["Alacritty", "Alacritty"],
        ["Custom executable…", "custom"],
      ],
    },
  },
  {
    type: "textfield",
    variable: "terminal_custom",
    label: "Custom terminal executable",
    config: { default: "", required: false, placeholder: "/absolute/path/to/terminal" },
    description: "Only used when Custom executable is selected.",
  },
  {
    type: "textfield",
    variable: "terminal_custom_args",
    label: "Custom terminal arguments (JSON)",
    config: { default: '["-e","/bin/zsh","-lc","{command}"]', required: false },
    description:
      "JSON argument array. {command} is the command plus an interactive shell; {cwd} is the working folder. No shell interpolation is applied to the argument array.",
  },
];
const quote = (text: string): string => "'" + text.replace(/'/g, "'\\''") + "'";
export const terminalPlan = (
  settings: Settings,
  request: Request,
): { file: string; args: string[] } => {
  const app = settings.str("terminal_app", "Ghostty"),
    cwd = request.cwd || "";
  if (cwd && (!isAbsolute(cwd) || !statSync(cwd).isDirectory()))
    throw new Error("Terminal working folder is unavailable.");
  const command = [cwd ? `cd -- ${quote(cwd)}` : "", request.command || ""]
    .filter(Boolean)
    .join("\n");
  if (command.includes("\0")) throw new Error("Invalid terminal command.");
  if (app === "Terminal" || app === "iTerm" || app === "iTerm2") {
    const code =
      app === "Terminal"
        ? 'tell application "Terminal"\nactivate\ndo script (item 1 of argv)\nend tell'
        : 'tell application "iTerm"\nactivate\nset createdWindow to (create window with default profile)\ntell current session of createdWindow to write text (item 1 of argv)\nend tell';
    return { file: "/usr/bin/osascript", args: ["-e", `on run argv\n${code}\nend run`, command] };
  }
  const interactive = `${command}\nexec /bin/zsh -l`;
  if (app === "custom") {
    const file = settings.str("terminal_custom");
    if (!isAbsolute(file))
      throw new Error("Set the custom terminal executable to an absolute path.");
    const args: unknown = JSON.parse(
      settings.str("terminal_custom_args", '["-e","/bin/zsh","-lc","{command}"]'),
    );
    if (
      !Array.isArray(args) ||
      !args.length ||
      args.length > 40 ||
      args.some((v) => typeof v !== "string" || v.includes("\0"))
    )
      throw new Error("Custom terminal arguments must be a JSON array of strings.");
    return {
      file,
      args: (args as string[]).map((v) =>
        v.replace(/\{command\}|\{cwd\}/g, (token) => (token === "{command}" ? interactive : cwd)),
      ),
    };
  }
  if (app === "Ghostty") {
    const script =
      'on run argv\ntell application "Ghostty"\nset config to {command:"/bin/zsh -lc " & quoted form of (item 1 of argv)}\nif item 2 of argv is not "" then set initial working directory of config to item 2 of argv\nnew window with configuration config\nactivate\nend tell\nend run';
    return { file: "/usr/bin/osascript", args: ["-e", script, interactive, cwd] };
  }
  if (["kitty", "WezTerm", "Alacritty"].includes(app)) {
    const args =
      app === "WezTerm"
        ? ["start", ...(cwd ? ["--cwd", cwd] : []), "--", "/bin/zsh", "-lc", interactive]
        : [
            ...(cwd ? [app === "kitty" ? "--directory" : "--working-directory", cwd] : []),
            "-e",
            "/bin/zsh",
            "-lc",
            interactive,
          ];
    return { file: "/usr/bin/open", args: ["-na", app, "--args", ...args] };
  }
  // Preserve older VS Code configurations containing a custom app name for folder-only actions.
  if (!request.command && cwd) return { file: "/usr/bin/open", args: ["-a", app, cwd] };
  throw new Error(
    "Choose a supported terminal or configure a custom executable in Workflow Configuration.",
  );
};
export const openTerminal = async (settings: Settings, request: Request): Promise<string> => {
  const plan = terminalPlan(settings, request);
  try {
    if (settings.str("terminal_app", "Ghostty") === "custom") {
      const child = spawn(plan.file, plan.args, { detached: true, stdio: "ignore" });
      await new Promise<void>((resolve, reject) =>
        child.once("spawn", resolve).once("error", reject),
      );
      child.unref();
      return "";
    }
    return (
      await execute(plan.file, plan.args, { encoding: "utf8", timeout: 10000, maxBuffer: 65536 })
    ).stdout;
  } catch (error) {
    if (
      /-1743|not authorized to send apple events/i.test(
        String((error as { stderr?: unknown })?.stderr || ""),
      )
    )
      throw new Error(
        `Allow Alfred to control ${settings.str("terminal_app", "Ghostty")} in System Settings → Privacy & Security → Automation, then try again.`,
      );
    throw new Error(
      `Could not open ${settings.str("terminal_app", "Ghostty")}. Check its installation and Workflow Configuration.`,
    );
  }
};
