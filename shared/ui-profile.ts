import { execFileSync } from "node:child_process";

export const STANDARD_WIDTH = 780;
export const DEFAULT_BACK = "⌃⌥⇧⌘B";
export const BACK_LABEL = "Hyper+B";
type Settings = {
  str: (key: string, fallback?: string) => string;
  bool: (key: string, fallback?: boolean) => boolean;
};
export const hyperConfiguration = () => [
  {
    type: "checkbox", variable: "hyper_enabled", label: "Hyper shortcuts",
    description: "Use the modifier checkboxes and Back key below. Disable to use the custom Back shortcut.",
    config: { default: true, text: "Enable Hyper key configuration" },
  },
  ...[["control", "Control"], ["option", "Option"], ["shift", "Shift"], ["command", "Command"]].map(([key, title]) => ({
    type: "checkbox", variable: `hyper_${key}`, label: `Hyper: ${title}`,
    config: { default: true, text: `Include ${title}` },
  })),
  {
    type: "textfield", variable: "back_key", label: "Back key",
    description: "One letter, number or punctuation key, combined with the enabled Hyper modifiers.",
    config: { default: "B", placeholder: "B", required: false },
  },
  {
    type: "textfield", variable: "back_shortcut", label: "Custom Back shortcut",
    description: "Used when Hyper shortcuts are disabled. For example ⌘[.",
    config: { default: DEFAULT_BACK, placeholder: DEFAULT_BACK, required: false },
  },
];
export const shortcutLabel = (shortcut: string): string =>
  ["⌃", "⌥", "⇧", "⌘"].every((m) => shortcut.includes(m))
    ? `Hyper+${shortcut.replace(/[⌃⌥⇧⌘]/g, "")}` : shortcut;

export const backBinding = ({ str, bool }: Settings): { shortcut: string; label: string } => {
  let shortcut = str("back_shortcut", DEFAULT_BACK);
  if (bool("hyper_enabled", true)) {
    const modifiers = [["control", "⌃"], ["option", "⌥"], ["shift", "⇧"], ["command", "⌘"]]
      .filter(([key]) => bool(`hyper_${key}`, true)).map(([, symbol]) => symbol).join("");
    const key = str("back_key", "B").toUpperCase();
    // Bare letters consume ordinary search input; keep an effective Back binding on invalid input.
    shortcut = modifiers && key.length === 1 && !/[\s⌃⌥⇧⌘]/u.test(key)
      ? `${modifiers}${key}` : DEFAULT_BACK;
  }
  return { shortcut, label: shortcutLabel(shortcut) };
};
export const fittedWidth = (available: number): number =>
  Number.isFinite(available) && available > 80
    ? Math.min(STANDARD_WIDTH, Math.floor(available - 40)) : STANDARD_WIDTH;

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
export const windowWidth = (): number => {
  try {
    return fittedWidth(Number(execFileSync("/usr/bin/osascript", ["-l", "JavaScript", "-e", screenProbe], {
      encoding: "utf8", timeout: 1500, stdio: ["ignore", "pipe", "ignore"],
    }).trim()));
  } catch { return STANDARD_WIDTH; }
};
export const profileAction = (settings: Settings) => {
  const back = backBinding(settings);
  return {
    variables: { back_shortcut: back.shortcut, back_label: back.label,
      actions_label: shortcutLabel(settings.str("actions_shortcut", "⌘K")) },
    update: { ids: { initialBack: { text: `Back  ${back.label}`, shortcut: back.shortcut } } },
    window: { resize: { width: windowWidth() } },
  };
};
