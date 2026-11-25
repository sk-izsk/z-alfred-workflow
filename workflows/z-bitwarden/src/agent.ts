import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { BUNDLE_ID, bool, readAccounts, workflowDir } from "./env.ts";
import { logError } from "./log.ts";
import { run } from "./proc.ts";

/**
 * A LaunchAgent that runs `bwa agent-tick` every 30 seconds. Without it, the idle, sleep and
 * screen locks only happen the next time you open the workflow, so the session key could sit in
 * the Keychain for hours after the timeout. It also syncs the vault in the background.
 */
export const AGENT_LABEL = `${BUNDLE_ID}.agent`;
const INTERVAL_S = 30;

const plistPath = () => join(homedir(), "Library/LaunchAgents", `${AGENT_LABEL}.plist`);
const domain = () => `gui/${process.getuid?.() ?? 501}`;

const xml = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

/**
 * If the workflow is deleted, the agent removes itself instead of failing every 30 seconds.
 * Paths are passed as arguments to `sh -c`, never spliced into the script.
 */
export const agentPlist = (
  launcher: string,
  plist: string,
  target: string,
): string => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xml(AGENT_LABEL)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-c</string>
    <string>if [ -x "$1" ]; then exec "$1" agent-tick; else rm -f "$2"; /bin/launchctl bootout "$3"; fi</string>
    <string>sh</string>
    <string>${xml(launcher)}</string>
    <string>${xml(plist)}</string>
    <string>${xml(target)}</string>
  </array>
  <key>StartInterval</key>
  <integer>${INTERVAL_S}</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>LimitLoadToSessionType</key>
  <string>Aqua</string>
  <key>ProcessType</key>
  <string>Background</string>
</dict>
</plist>
`;

const loaded = async (): Promise<boolean> =>
  (await run("/bin/launchctl", ["print", `${domain()}/${AGENT_LABEL}`])).code === 0;

export const removeAgent = async (): Promise<void> => {
  rmSync(plistPath(), { force: true });
  await run("/bin/launchctl", ["bootout", `${domain()}/${AGENT_LABEL}`]);
};

/** Install or refresh the agent (after an unlock). A failure is logged, never shown: it must not block an unlock. */
export const ensureAgent = async (): Promise<void> => {
  try {
    if (!bool("background_agent", true)) return await removeAgent();
    // The same launcher Alfred runs: it finds Node (or the configured Node path) by itself.
    const launcher = join(workflowDir(), "bin", "bwa");
    if (!existsSync(join(workflowDir(), "bin", "bwa.mjs"))) return; // tests and dev checkouts
    const target = `${domain()}/${AGENT_LABEL}`;
    const plist = agentPlist(launcher, plistPath(), target);
    const current = existsSync(plistPath()) ? readFileSync(plistPath(), "utf8") : "";
    if (current === plist && (await loaded())) return;
    writeFileSync(plistPath(), plist, { mode: 0o644 });
    await run("/bin/launchctl", ["bootout", target]);
    const { code, stderr } = await run("/bin/launchctl", ["bootstrap", domain(), plistPath()]);
    if (code !== 0) throw new Error(`launchctl bootstrap failed: ${stderr.trim()}`);
  } catch (error) {
    logError("install agent", error);
  }
};

/** `ioreg` reports `IOConsoleLocked` while the screen is locked (or the login window shows). */
export const parseScreenLocked = (ioreg: string): boolean =>
  /<key>IOConsoleLocked<\/key>\s*<true\/>/.test(ioreg);

const screenLocked = async (): Promise<boolean> => {
  const { code, stdout } = await run("/usr/sbin/ioreg", ["-n", "Root", "-d1", "-a"], { timeoutMs: 3000 });
  return code === 0 && parseScreenLocked(stdout);
};

const SYNC_EVERY_MS = 5 * 60_000;

/**
 * One pass over every account: lock what has timed out, slept or sits behind a locked screen,
 * then keep the encrypted vault cache fresh so opening the workflow needs no sync.
 * It never extends the idle timer.
 * ponytail: polls every 30 s, so a screen locked and unlocked within that window is missed;
 * a resident notification listener would close the gap.
 */
export const agentTick = async (): Promise<void> => {
  if (!bool("background_agent", true)) return removeAgent();
  const screenIsLocked = bool("lock_on_screen_lock", true) && (await screenLocked());
  const session = await import("./session.ts");
  const ids = session.allAccounts().map((a) => a.id);
  for (const id of ids.length ? ids : [readAccounts().active]) {
    process.env.bw_account = id; // this process serves one account at a time (see env.accountId)
    try {
      if (!session.readState().sessionId) continue; // already locked
      if (screenIsLocked) {
        await session.lock();
        continue;
      }
      const active = await session.getSession(false); // applies the idle and sleep locks
      if (!active || !bool("background_sync", true)) continue;
      const { readCache, fetchVault } = await import("./vault.ts");
      if (Date.now() - (readCache()?.syncedAt ?? 0) > SYNC_EVERY_MS) await fetchVault(active, true);
    } catch (error) {
      logError(`agent ${id}`, error);
    }
  }
};
