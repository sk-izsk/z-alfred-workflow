import { bwPath } from "./bw.ts";
import { clearIfUnchanged } from "./clipboard.ts";
import { log as writeLog, logError } from "./log.ts";
import { fetchIcons } from "./icons.ts";
import * as account from "./commands/account.ts";
import * as auth from "./commands/authenticator.ts";
import * as create from "./commands/create.ts";
import * as gen from "./commands/generator.ts";
import * as item from "./commands/item.ts";
import { post } from "./commands/post.ts";
import * as root from "./commands/root.ts";
import * as search from "./commands/search.ts";
import * as sends from "./commands/sends.ts";
import { sleep } from "./keys.ts";
import * as session from "./session.ts";
import { type Action, errorStatus, merge, print, status, update, vars } from "./ui.ts";

type Command = (args: string[]) => Promise<Action> | Action;

/** Commands called from Alfred UI windows: they print a JSON action. */
const ui: Record<string, Command> = {
  // search window
  "search-init": search.init,
  "search-refresh": search.refresh,
  "search-site": search.site,
  folder: search.folder,
  selected: search.selected,
  "search-tick": search.tick,
  sync: search.sync,
  item: item.itemCommand,
  field: item.fieldCommand,
  "set-totp": item.setTotp,
  "account-add": search.addAccount,
  "account-switch": search.switchAccount,
  "login-sheet": async ([view = "search", method = "password"]) =>
    (await import("./views.ts")).loginSheet(view as never, method === "apikey" ? "apikey" : "password"),
  "lock-ui": async () => {
    await session.lock();
    return merge(
      // Drop everything the window holds, so nothing stays on screen or in memory after a lock.
      vars({ totp_seeds: "", fill_data: "", window_session: "" }),
      update({ items: { data: { src: [] } } }),
      status("Locked"),
      await account.authSheet("search"),
    );
  },
  // accounts (any window)
  login: account.login,
  "login-password": account.loginPassword,
  unlock: account.unlock,
  "quick-unlock": account.quickUnlock,
  reprompt: account.reprompt,
  // generator
  gen: gen.genCommand,
  "gen-copy": gen.genCopy,
  // authenticator
  "auth-init": auth.authInit,
  "auth-load": auth.authLoad,
  "auth-tick": auth.authTick,
  "auth-copy": auth.authCopy,
  // sends
  "sends-init": sends.sendsInit,
  "sends-load": sends.sendsLoad,
  "send-copy": sends.sendCopy,
  "send-delete": sends.sendDelete,
  "send-create": sends.sendCreate,
  "send-receive": sends.sendReceive,
  // new login / note
  "new-init": create.newInit,
  "new-check": create.newCheck,
  "new-generate": create.newGenerate,
  "new-type": create.newType,
  "new-save": create.newSave,
};

/** Commands called from Run Script objects: they print plain text (for a notification). */
const scripts: Record<string, (args: string[]) => Promise<void>> = {
  post,
  root: root.root,
  "root-action": root.rootAction,
  lock: account.lockCommand,
  logout: account.logoutCommand,
  "sync-vault": account.syncCommand,
  "gen-quick": gen.genQuick,
  "create-folder": create.createFolder,
  "fetch-icons": (hosts) => fetchIcons(hosts),
  /** The LaunchAgent, every 30 s: enforce the locks and sync in the background. */
  "agent-tick": async () => (await import("./agent.ts")).agentTick(),
  /** Detached helper from clipboard.scheduleClear. */
  "clear-after": async ([seconds = "0", count = "0"]) => {
    await sleep(Number(seconds) * 1000);
    await clearIfUnchanged(Number(count));
  },
};

const [command = "", ...args] = process.argv.slice(2);

const started = performance.now();
/** The per-second TOTP ticks would flood the log. */
const quiet = command.endsWith("-tick");
const log = (line: string) => (quiet ? undefined : writeLog(line));
const elapsed = () => `${Math.round(performance.now() - started)}ms`;
log(`▶ ${command} (node ${process.version}, bw ${bwPath()})`);

if (command in ui) {
  try {
    print(await ui[command]!(args));
    log(`✓ ${command} ${elapsed()}`);
  } catch (error) {
    logError(command, error);
    print(errorStatus(error));
  }
} else if (command in scripts) {
  await scripts[command]!(args)
    .then(() => log(`✓ ${command} ${elapsed()}`))
    .catch((error: unknown) => {
      logError(command, error);
      process.stdout.write(error instanceof Error ? error.message : String(error));
    });
} else {
  logError("router", new Error(`Unknown command: ${command}`));
  process.stdout.write(`Unknown command: ${command}`);
}
