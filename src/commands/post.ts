import { copySecret, scheduleClear } from "../clipboard.ts";
import { bool, num, str } from "../env.ts";
import { pressKey, pressPaste, sleep } from "../keys.ts";
import { log, timed } from "../log.ts";
import { run } from "../proc.ts";
import { requireSession } from "../session.ts";
import { totpCode } from "../totp.ts";
import { getItem } from "../vault.ts";

/**
 * Runs as a Run Script after the window closes, so the app you came from is in front again.
 * Prints a short line for the notification (empty = no notification).
 */

/** Long enough for the target app to read the clipboard before we replace it. */
const SETTLE_MS = 140;
const clearSeconds = () => num("clipboard_clear", 60);

const pasteValue = async (value: string): Promise<number> => {
  const count = await copySecret(value);
  await sleep(40);
  await pressPaste();
  await sleep(SETTLE_MS);
  return count;
};

/** Username/password/TOTP handed over by the window, or fetched if it hadn't loaded yet. */
const fillValues = async () => {
  if (str("fill_ready") === "1") {
    return {
      name: "",
      username: process.env.fill_u ?? "",
      password: process.env.fill_p ?? "",
      totp: process.env.fill_t ?? "",
    };
  }
  const item = await getItem(await requireSession(), str("item_id"));
  const { username, password, totp } = item.login ?? {};
  return { name: item.name, username: username ?? "", password: password ?? "", totp: totp ?? "" };
};

const fill = async (): Promise<string> => {
  log(`fill: values ${str("fill_ready") === "1" ? "from window memory" : "fetched from bw"}`);
  const { name, username, password, totp } = await timed("fill: get values", fillValues);
  await sleep(120); // let focus return to the page
  if (username) {
    await timed("fill: paste username", () => pasteValue(username));
    if (password) await pressKey("tab");
  }
  let last = password ? await timed("fill: paste password", () => pasteValue(password)) : 0;
  if (password && bool("fill_submit")) await pressKey("return");
  if (totp && bool("copy_totp_after_fill", true)) {
    last = await copySecret(totpCode(totp));
    scheduleClear(last, Math.max(clearSeconds(), 30));
    return name ? `TOTP for ${name} copied` : "TOTP copied";
  }
  scheduleClear(last, clearSeconds());
  return "";
};

const paste = async (): Promise<string> => {
  await sleep(SETTLE_MS);
  await pressPaste();
  scheduleClear(Number(str("bw_cc")), clearSeconds());
  return "";
};

/** Back shortcut (default ⌘[) in a window: reopen the `bw` menu. */
const back = async (): Promise<string> => {
  const keyword = str("kw_search", "bw").replaceAll('"', "");
  await run("/usr/bin/osascript", [
    "-e",
    `tell application id "com.runningwithcrayons.Alfred" to search "${keyword} "`,
  ]);
  return "";
};

const STEPS: Record<string, () => Promise<string>> = { fill, paste, back };

export const post = async (): Promise<void> => {
  const step = STEPS[str("bw_out")];
  if (!step) return;
  try {
    process.stdout.write(await step());
  } catch (error) {
    process.stdout.write(error instanceof Error ? error.message : String(error));
  }
};
