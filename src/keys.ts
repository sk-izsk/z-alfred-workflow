import { run } from "./proc.ts";

/**
 * Keystrokes into the app you came from, via System Events.
 * Runs as a child of Alfred, so it uses Alfred's Accessibility permission.
 */
const KEY_CODES = { return: 36, tab: 48 } as const;

const systemEvents = async (body: string): Promise<void> => {
  const { code, stderr } = await run("/usr/bin/osascript", [
    "-e",
    `tell application "System Events" to ${body}`,
  ]);
  if (code !== 0)
    throw new Error(stderr.includes("1002") ? "Allow Alfred in Accessibility settings" : stderr.trim());
};

export const pressPaste = (): Promise<void> => systemEvents(`keystroke "v" using command down`);
export const pressKey = (key: keyof typeof KEY_CODES): Promise<void> =>
  systemEvents(`key code ${KEY_CODES[key]}`);

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
