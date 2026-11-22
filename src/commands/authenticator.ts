import { copySecret, scheduleClear } from "../clipboard.ts";
import { bool, num } from "../env.ts";
import { getSession, windowBinding, windowValid } from "../session.ts";
import { formatCode, totpCode, totpPeriod, totpRemaining } from "../totp.ts";
import { type Action, finish, fn, merge, status, update, vars } from "../ui.ts";
import { loadVaultData } from "../vault.ts";
import { withSession } from "./account.ts";

/** `seed` is empty for re-prompt items: their code stays hidden until you confirm. */
type Entry = { id: string; name: string; user: string; seed: string; protected?: boolean };

const seeds = (): Entry[] => {
  try {
    return JSON.parse(process.env.auth_entries || "[]") as Entry[];
  } catch {
    return [];
  }
};

const row = (e: Entry, now = Date.now()) => {
  if (e.protected) {
    return {
      uid: e.id,
      "authName.text": e.name,
      "authUser.text": e.user,
      "authCode.text": "••• •••",
      "authCode.colour": "secondaryLabelColor",
      "authTime.text": "🔒",
      "authProgress.progress": 0,
      match: `${e.name} ${e.user}`,
    };
  }
  let code = "------";
  let left = 0;
  let period = 30;
  try {
    code = formatCode(totpCode(e.seed, now));
    left = totpRemaining(e.seed, now);
    period = totpPeriod(e.seed);
  } catch {
    code = "invalid key";
  }
  return {
    uid: e.id,
    "authName.text": e.name,
    "authUser.text": e.user,
    "authCode.text": code,
    "authCode.colour": left <= 5 ? "systemRedColor" : "labelColor",
    "authTime.text": `${left}s`,
    "authProgress.progress": period ? left / period : 0,
    match: `${e.name} ${e.user}`,
  };
};

/** preload */
export const authInit = async (): Promise<Action> =>
  status((await getSession()) ? "Loading codes…" : "Locked");

/** Fetch logins with a TOTP key; keys stay in this window's memory (a UI variable). */
export const loadCodes = async (active: string): Promise<Action> => {
  const { items } = await loadVaultData(active);
  const entries: Entry[] = items
    .filter((i) => i.login?.totp)
    .map((i) => ({
      id: i.id,
      name: i.name,
      user: i.login?.username ?? "",
      seed: i.reprompt === 1 ? "" : (i.login?.totp ?? ""),
      protected: i.reprompt === 1,
    }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
  return merge(
    vars({ auth_entries: JSON.stringify(entries), ...windowBinding() }),
    update({ codes: { data: { src: entries.map((e) => row(e)) } } }),
    fn({ codes: ["filterdata", "selectfirst"] }),
    status(entries.length ? `${entries.length} authenticator codes` : "No logins with a TOTP key"),
    { pulse: { interval: 1 } },
  );
};

export const authLoad = (): Promise<Action> => withSession("auth", loadCodes);

const staleWindow = (): Action =>
  merge(
    vars({ auth_entries: "", window_session: "" }),
    update({ codes: { data: { src: [] } } }),
    status("Vault locked. Reopen Authenticator to unlock.", "systemOrangeColor"),
    { pulse: { interval: 0 } },
  );

/** Pulse, every second: refresh codes and countdowns in place (selection stays). */
export const authTick = async (): Promise<Action> => {
  if (!process.env.window_session) return {}; // nothing loaded yet
  // Background ticks must neither keep showing codes after a lock nor extend the idle timer.
  if (!(await windowValid())) return staleWindow();
  const entries = seeds().filter((e) => !e.protected);
  if (!entries.length) return {};
  const now = Date.now();
  return update({
    codes: {
      data: {
        modify: {
          replace: { autoselect: false, srcmap: Object.fromEntries(entries.map((e) => [e.id, row(e, now)])) },
        },
      },
    },
  });
};

export const authCopy = async ([id = "", mode = "copy"]: string[]): Promise<Action> => {
  // Codes held by an open window must stop working once the vault locks or the account changes.
  if (!(await windowValid())) return staleWindow();
  await getSession(); // a real use: restart the idle timer
  const entry = seeds().find((e) => e.id === id);
  if (!entry) return status("Select a code first", "systemOrangeColor");
  if (entry.protected) {
    const { runItemAction } = await import("./item.ts");
    return runItemAction(mode === "paste" ? "paste-totp" : "copy-totp", id);
  }
  const count = await copySecret(totpCode(entry.seed));
  if (mode === "paste") return finish({ bw_out: "paste", bw_cc: String(count) });
  scheduleClear(count, Math.max(num("clipboard_clear", 60), 30));
  return bool("close_on_copy", true) ? finish() : status(`Copied code for ${entry.name}`);
};
