import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";

export const STANDARD_WIDTH = 780;
export const DEFAULT_BACK = "⌃⌥⇧⌘B";
export const BACK_LABEL = "Hyper+B";
type Settings = {
  str: (key: string, fallback?: string) => string;
  bool: (key: string, fallback?: boolean) => boolean;
  saved?: (key: string) => string | undefined;
};
let userPreferences: Record<string, unknown> | undefined;
const preference = (key: string): string | undefined => {
  if (!userPreferences) {
    try {
      userPreferences = JSON.parse(
        execFileSync(
          "/usr/bin/plutil",
          ["-convert", "json", "-o", "-", join(dirname(dirname(process.argv[1] || ".")), "prefs.plist")],
          { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
        ),
      );
    } catch {
      userPreferences = {};
    }
  }
  const value = userPreferences?.[key];
  return value === undefined ? undefined : String(value);
};
export const hyperConfiguration = () => [
  {
    type: "checkbox",
    variable: "hyper_enabled",
    label: "Hyper shortcuts",
    description: "Use the modifier checkboxes and Back key below. Disable to use the custom Back shortcut.",
    config: { default: true, text: "Enable Hyper key configuration" },
  },
  ...[
    ["control", "Control"],
    ["option", "Option"],
    ["shift", "Shift"],
    ["command", "Command"],
  ].map(([key, title]) => ({
    type: "checkbox",
    variable: `hyper_${key}`,
    label: `Hyper: ${title}`,
    config: { default: true, text: `Include ${title}` },
  })),
  {
    type: "textfield",
    variable: "back_key",
    label: "Back key",
    description: "One letter, number or punctuation key, combined with the enabled Hyper modifiers.",
    config: { default: "B", placeholder: "B", required: false },
  },
  {
    type: "textfield",
    variable: "back_shortcut",
    label: "Custom Back shortcut",
    description: "Used when Hyper shortcuts are disabled. For example ⌘[.",
    config: { default: DEFAULT_BACK, placeholder: DEFAULT_BACK, required: false },
  },
];
export const shortcutLabel = (shortcut: string): string =>
  ["⌃", "⌥", "⇧", "⌘"].every((m) => shortcut.includes(m))
    ? `Hyper+${shortcut.replace(/[⌃⌥⇧⌘]/g, "")}`
    : shortcut;

export const backBinding = ({
  str,
  bool,
  saved = preference,
}: Settings): { shortcut: string; label: string } => {
  let shortcut = str("back_shortcut", DEFAULT_BACK);
  const previous = saved("back_shortcut");
  if (saved("hyper_enabled") === undefined && previous && previous !== "⌘[" && previous !== DEFAULT_BACK)
    return { shortcut: previous, label: shortcutLabel(previous) };
  if (bool("hyper_enabled", true)) {
    const modifiers = [
      ["control", "⌃"],
      ["option", "⌥"],
      ["shift", "⇧"],
      ["command", "⌘"],
    ]
      .filter(([key]) => bool(`hyper_${key}`, true))
      .map(([, symbol]) => symbol)
      .join("");
    const key = str("back_key", "B").toUpperCase();
    // Bare letters consume ordinary search input; keep an effective Back binding on invalid input.
    shortcut = modifiers && key.length === 1 && !/[\s⌃⌥⇧⌘]/u.test(key) ? `${modifiers}${key}` : DEFAULT_BACK;
  }
  return { shortcut, label: shortcutLabel(shortcut) };
};
export const fittedWidth = (available: number): number =>
  Number.isFinite(available) && available > 80
    ? Math.min(STANDARD_WIDTH, Math.floor(available - 40))
    : STANDARD_WIDTH;

const screenProbe = `ObjC.import('AppKit');
ObjC.import('CoreGraphics');
var screens=$.NSScreen.screens;
if(!screens.count) throw new Error('No display available');
var primary=screens.objectAtIndex(0).frame;
var top=primary.origin.y+primary.size.height;
var apps=$.NSRunningApplication.runningApplicationsWithBundleIdentifier('com.runningwithcrayons.Alfred');
var pid=apps.count ? apps.objectAtIndex(0).processIdentifier : -1;
var windows=ObjC.deepUnwrap(ObjC.castRefToObject($.CGWindowListCopyWindowInfo(1,0)));
var current=null;
for(var j=0;j<windows.length;j++){var w=windows[j];if(w.kCGWindowOwnerPID===pid && w.kCGWindowBounds.Width>100){current=w;break;}}
var chosen=$.NSScreen.mainScreen;
if(current){
 var b=current.kCGWindowBounds,cx=b.X+b.Width/2,cy=b.Y+b.Height/2;
 for(var i=0;i<screens.count;i++){
  var screen=screens.objectAtIndex(i),f=screen.frame;
  if(cx>=f.origin.x&&cx<f.origin.x+f.size.width&&cy>=top-f.origin.y-f.size.height&&cy<top-f.origin.y){chosen=screen;break;}
 }
}
chosen ? String(chosen.visibleFrame.size.width) : '820';
`;
/**
 * One probe result shared by every workflow for 10 minutes: the probe (JXA) costs about 150 ms
 * and blocks the window from opening, but only changes the width on displays under 820 points.
 */
const DISPLAY_CACHE = join(
  homedir(),
  "Library/Caches/com.runningwithcrayons.Alfred/Workflow Data/com.izsk.shared/display-width.json",
);
const DISPLAY_TTL = 10 * 60_000;

const probeDisplay = (): number => {
  try {
    return Number(
      execFileSync("/usr/bin/osascript", ["-l", "JavaScript", "-e", screenProbe], {
        encoding: "utf8",
        timeout: 1500,
        stdio: ["ignore", "pipe", "ignore"],
      }).trim(),
    );
  } catch {
    return NaN;
  }
};

/** Visible width of the display Alfred is on; NaN when unknown. */
export const displayWidth = (): number => {
  try {
    const cached = JSON.parse(readFileSync(DISPLAY_CACHE, "utf8")) as { at: number; width: number };
    if (Date.now() - cached.at < DISPLAY_TTL && cached.width > 0) return cached.width;
  } catch {
    // no cache yet
  }
  const width = probeDisplay();
  if (width > 0)
    try {
      mkdirSync(dirname(DISPLAY_CACHE), { recursive: true });
      writeFileSync(DISPLAY_CACHE, JSON.stringify({ at: Date.now(), width }));
    } catch {
      // a read-only cache only costs the next probe
    }
  return width;
};
export const windowWidth = (): number => fittedWidth(displayWidth());
export const profileAction = (settings: Settings, backIDs: string[] = ["initialBack"]) => {
  const back = backBinding(settings);
  return {
    variables: {
      back_shortcut: back.shortcut,
      back_label: back.label,
      actions_label: shortcutLabel(settings.str("actions_shortcut", "⌘K")),
    },
    ...(backIDs.length
      ? {
          update: {
            ids: Object.fromEntries(
              backIDs.map((id) => [id, { text: `Back  ${back.label}`, shortcut: back.shortcut }]),
            ),
          },
        }
      : {}),
    window: { resize: { width: windowWidth() } },
  };
};

/** Shared generation rules; independent bundles keep their own navigation and identifiers. */
export const profileInfo = <T extends Record<string, any>>(info: T): T => {
  const config = info.userconfigurationconfig || [];
  if (config.some((item: any) => item.variable === "hyper_enabled")) return info;
  const result: any[] = [];
  let inserted = false;
  for (const item of config) {
    if (item.variable === "back_shortcut") {
      result.push(...hyperConfiguration());
      inserted = true;
    } else result.push(item);
  }
  if (!inserted) result.push(...hyperConfiguration());
  return { ...info, userconfigurationconfig: result };
};
export const profileWindow = <T extends Record<string, any>>(original: T, cli: string): T => {
  const ui: Record<string, any> = structuredClone(original),
    backIDs: string[] = [];
  ui.variablesconfig = {
    ...ui.variablesconfig,
    back_shortcut: { ...ui.variablesconfig?.back_shortcut, default: DEFAULT_BACK },
    back_label: { default: BACK_LABEL },
    actions_label: { default: "⌘K" },
  };
  ui.window.size = { ...ui.window.size, width: STANDARD_WIDTH };
  if (ui.window.minsize?.width > 560) ui.window.minsize.width = 560;
  const visit = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (
      node.type === "button" &&
      node.id &&
      typeof node.text === "string" &&
      node.text.startsWith("Back") &&
      node.shortcut === "{var:back_shortcut}"
    )
      backIDs.push(node.id);
    for (const child of node.components || []) visit(child);
  };
  visit(ui.window.root);
  const normalize = (value: any) => {
    if (!value || typeof value !== "object") return;
    if (typeof value.text === "string")
      value.text = value.text
        .replace(/Back  ?\{var:back_shortcut\}/g, "Back  {var:back_label}")
        .replace(/Actions  ?\{var:actions_shortcut\}/g, "Actions  {var:actions_label}");
    if (value.window?.resize?.width) value.window.resize.width = STANDARD_WIDTH;
    if (value.type && value.constraints?.size?.width > 704) value.constraints.size.width = 704;
    for (const child of Object.values(value)) if (typeof child === "object") normalize(child);
  };
  normalize(ui.window.root);
  const action = { type: "script", src: `../bin/${cli}`, args: ["ui-profile", ...backIDs], async: false };
  let inserted = false;
  const events = ui.window.root.events || [];
  ui.window.root.events = events.map((event: any) => {
    const triggers = Array.isArray(event.triggers) ? event.triggers : [event.triggers];
    if (!inserted && triggers.includes("launched")) {
      inserted = true;
      return { ...event, action: [action, ...(Array.isArray(event.action) ? event.action : [event.action])] };
    }
    return event;
  });
  if (!inserted) ui.window.root.events.push({ triggers: "launched", action });
  return ui as T;
};
export const profileCommand = async (load: () => Promise<Settings>): Promise<void> => {
  if (process.argv[2] !== "ui-profile") return;
  const settings = await load(),
    action = profileAction(settings, process.argv.slice(3));
  await new Promise<void>((resolve) => process.stdout.write(JSON.stringify(action), () => resolve()));
  process.exit(0);
};
