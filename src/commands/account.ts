import { spawn } from "node:child_process";
import { BwError } from "../bw.ts";
import { publicEnv } from "../proc.ts";
import { str } from "../env.ts";
import * as session from "../session.ts";
import { type Action, closeSheet, errorStatus, merge, status, update, vars } from "../ui.ts";
import { loginSheet, unlockSheet, type View } from "../views.ts";

/** Wipes the secret variables the sheets used to hand us a password. */
const clearSecrets = vars({ secret_input: "", secret_pin: "" });

const sheetError = (error: unknown): Action =>
  merge(
    update({ sheetStatus: { text: error instanceof Error ? error.message : String(error) } }),
    { sound: { src: "Basso" } },
    clearSecrets,
  );

/** The login or unlock sheet, whichever this vault needs. */
export const authSheet = async (view: View): Promise<Action> => {
  const state = session.readState();
  if (!state.loggedIn) return loginSheet(view);
  const mode = session.quickUnlockMode();
  const quick = await session.canQuickUnlock();
  return unlockSheet(view, {
    email: state.email ?? "",
    pinMode: mode === "pin",
    pinSet: mode === "pin" && quick,
    touchId: mode === "touchid" && quick,
  });
};

export const isAuthError = (error: unknown): boolean =>
  /locked|not logged in|session key|unauthenticated|You are not logged in/i.test(
    error instanceof BwError ? `${error.message} ${error.stderr}` : String(error),
  );

/**
 * Run a view command with a session. No session → show the right sheet.
 * Errors → a red status line instead of a crash.
 */
export const withSession = async (view: View, fn: (session: string) => Promise<Action>): Promise<Action> => {
  const active = await session.getSession();
  if (!active) return merge(status("Locked"), await authSheet(view));
  try {
    return await fn(active);
  } catch (error) {
    if (!isAuthError(error)) return errorStatus(error);
    await session.lock();
    return merge(status("Locked"), await authSheet(view));
  }
};

/** Reload a view's data once we have a session (lazy import avoids a module cycle). */
const reload = async (view: View, active: string): Promise<Action> => {
  const loaders: Record<View, () => Promise<(s: string) => Promise<Action>>> = {
    search: async () => (await import("./search.ts")).loadVault,
    auth: async () => (await import("./authenticator.ts")).loadCodes,
    sends: async () => (await import("./sends.ts")).loadSends,
    newlogin: async () => async () => status("Unlocked"),
  };
  return (await loaders[view]())(active);
};

const afterUnlock = async (view: View, active: string): Promise<Action> =>
  merge(closeSheet("authSheet"), clearSecrets, await reload(view, active));

export const login = async ([view = "search", clientId = "", server = ""]: string[]): Promise<Action> => {
  try {
    if (!clientId || !str("secret_input")) throw new Error("Enter your client_id and client_secret");
    await session.login(clientId, str("secret_input"), server);
    return merge(closeSheet("authSheet"), clearSecrets, await authSheet(view as View));
  } catch (error) {
    return sheetError(error);
  }
};

export const unlock = async ([view = "search"]: string[]): Promise<Action> => {
  const master = process.env.secret_input ?? "";
  const pin = process.env.secret_pin ?? "";
  try {
    if (master) {
      const active = await session.unlock(master);
      if (pin && session.quickUnlockMode() === "pin" && !session.readState().pinHash) session.setPin(pin);
      return afterUnlock(view as View, active);
    }
    if (pin) return afterUnlock(view as View, await session.quickUnlock(pin));
    throw new Error("Enter your master password");
  } catch (error) {
    return sheetError(error instanceof BwError ? new Error("Invalid master password") : error);
  }
};

const TRIGGERS: Record<View, string> = { search: "search", auth: "auth", sends: "sends", newlogin: "new" };

/**
 * The system auth prompt takes focus, and Alfred closes its window when it loses focus.
 * So after unlocking, reopen the window if it's gone (detached: this script must return first).
 */
const reopenIfClosed = (view: View): void => {
  spawn(
    "/usr/bin/osascript",
    [
      "-e",
      "delay 0.5",
      "-e",
      'tell application "System Events" to set n to count windows of process "Alfred"',
      "-e",
      `if n is 0 then tell application id "com.runningwithcrayons.Alfred" to run trigger "${TRIGGERS[view]}" in workflow "com.izsk.bitwarden"`,
    ],
    { detached: true, stdio: "ignore", env: publicEnv() },
  ).unref();
};

/** Touch ID button, and the automatic prompt when a locked window opens. */
/** After a cancelled automatic prompt, don't prompt again on the reopen; show the sheet. */
const SKIP_AUTO_MS = 15_000;

export const quickUnlock = async ([view = "search", auto = ""]: string[]): Promise<Action> => {
  if (auto && (session.quickUnlockMode() !== "touchid" || !(await session.canQuickUnlock()))) return {};
  if (auto && (await session.getSession())) return {};
  if (auto && Date.now() - (session.readState().autoCancelledAt ?? 0) < SKIP_AUTO_MS) return {};
  try {
    const result = await afterUnlock(view as View, await session.quickUnlock());
    reopenIfClosed(view as View);
    return result;
  } catch (error) {
    if (!auto) return sheetError(error);
    // The prompt closed Alfred's window; bring it back with the unlock sheet instead.
    session.writeState({ autoCancelledAt: Date.now() });
    reopenIfClosed(view as View);
    return {};
  }
};

/** Re-prompt check for protected items; then run the action that asked for it. */
export const reprompt = async ([action = "", id = ""]: string[]): Promise<Action> => {
  if (!session.verifyMaster(process.env.secret_input ?? ""))
    return sheetError(new Error("Wrong master password"));
  session.writeState({ repromptedAt: Date.now() });
  const { runItemAction } = await import("./item.ts");
  return merge(closeSheet("repromptSheet"), clearSecrets, await runItemAction(action, id, true));
};

// --- keyword commands (Run Script → notification text on stdout) ---

const say = (text: string): void => void process.stdout.write(text);

export const lockCommand = async (): Promise<void> => {
  await session.lock();
  say("Vault locked");
};

export const logoutCommand = async (): Promise<void> => {
  await session.logout();
  say("Logged out of Bitwarden");
};

export const syncCommand = async (): Promise<void> => {
  const active = await session.getSession();
  if (!active) return say("Vault is locked. Open it with the search keyword first.");
  const { fetchVault } = await import("../vault.ts");
  const vault = await fetchVault(active, true);
  say(`Vault synced · ${vault.items.length} items`);
};
