import { osascript } from "./proc.ts";

/** Selected Finder items, or the front Finder window's folder when nothing is selected. */
export const finderSelection = async (): Promise<string[]> => {
  const out = await osascript(`tell application "Finder"
    set picked to selection as alias list
    if picked is {} then
      try
        return POSIX path of (insertion location as alias)
      on error
        return ""
      end try
    end if
    set paths to {}
    repeat with f in picked
      set end of paths to POSIX path of f
    end repeat
    set AppleScript's text item delimiters to linefeed
    return paths as text
  end tell`);
  return out.split("\n").filter(Boolean);
};
