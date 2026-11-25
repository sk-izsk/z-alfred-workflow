import { copySecret, passwordsOffClipboard, scheduleClear } from "../clipboard.ts";
import { bool, num, str } from "../env.ts";
import { pressKey, pressPaste, sleep, typeText } from "../keys.ts";
import { log, timed } from "../log.ts";
import { run } from "../proc.ts";
import { requireSession, windowValid } from "../session.ts";
import { totpCode } from "../totp.ts";
import { getItem } from "../vault.ts";

/**
 * Runs as a Run Script after the window closes, so the app you came from is in front again.
 * Prints a short line for the notification (empty = no notification).
 */

/** Long enough for the target app to read the clipboard before we replace it. */
const SETTLE_MS = 140;
const clearSeconds = () => num("clipboard_clear", 60);

/** Keystroke typing is only reliable for plain ASCII; other letters get mistyped by macOS. */
const typable = (value: string) => /^[\x20-\x7E]*$/.test(value);

const typingError =
  "Clipboard-free typing supports plain ASCII only. Nothing was copied. Use ordinary paste mode for this value.";

/** Never silently put a value on the clipboard when clipboard-free mode is enabled. */
const typeValue = async (value: string): Promise<number> => {
  if (!typable(value)) throw new Error(typingError);
  await typeText(value);
  await sleep(SETTLE_MS);
  return 0;
};

const pasteValue = async (value: string): Promise<number> => {
  if (passwordsOffClipboard()) return typeValue(value);
  const count = await copySecret(value);
  scheduleClear(count, clearSeconds()); // armed now: a failing paste must not leave the secret behind
  await sleep(40);
  await pressPaste();
  await sleep(SETTLE_MS);
  return count;
};

/** Username/password/TOTP handed over by the window, or fetched if it hadn't loaded yet. */
const fillValues = async () => {
  if (str("fill_ready") === "1") {
    // Secrets held by the window only count while it belongs to the current unlock and account.
    if (!(await windowValid())) throw new Error("Vault changed or locked. Reopen it to try again.");
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
  // Validate both fields before typing either, so a half-filled form or clipboard fallback can't happen.
  if (passwordsOffClipboard() && (!typable(username) || !typable(password))) throw new Error(typingError);
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
  return "";
};

const paste = async (): Promise<string> => {
  scheduleClear(Number(str("bw_cc")), clearSeconds()); // before pressing ⌘V, so a failure still clears
  await sleep(SETTLE_MS);
  await pressPaste();
  return "";
};

/** Back shortcut (default ⌘[) in a window: return to the Bitwarden command menu. */
const back = async (): Promise<string> => {
  await run("/usr/bin/osascript", [
    "-e",
    'on run argv\ntell application id "com.runningwithcrayons.Alfred" to search (item 1 of argv)\nend run',
    `${str("kw_main", "bw")} `,
  ]);
  return "";
};

/** ⌘↩ with "never put passwords on the clipboard": type the value handed over by the window. */
const type = async (): Promise<string> => {
  if (process.env.type_generated !== "1" && !(await windowValid()))
    throw new Error("Vault changed or locked. Reopen it to try again.");
  await sleep(SETTLE_MS);
  await typeValue(process.env.type_value ?? "");
  return "";
};

const STEPS: Record<string, () => Promise<string>> = { fill, paste, back, type };

export const post = async (): Promise<void> => {
  const step = STEPS[str("bw_out")];
  if (!step) return;
  try {
    process.stdout.write(await step());
  } catch (error) {
    process.stdout.write(error instanceof Error ? error.message : String(error));
  }
};
