// Isolated subprocess: every OS/CLI/authentication boundary is stubbed; only dummy values.
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temp = mkdtempSync(join(tmpdir(), "bwa-security-"));
process.env.alfred_workflow_data = temp;
process.env.alfred_workflow_cache = temp;
process.env.vault_timeout = "1";
let token: string | undefined;
let master: string | undefined;
let authCalls = 0;
let failDelete = false;
let duringFetch: (() => Promise<void>) | undefined;
const effects: string[] = [];
const failGetKinds = new Set<string>();
const reads: string[] = [];
const bwCalls: string[][] = [];

mock.module("../../src/keychain.ts", () => ({
  keychainGet: async (kind: string) => {
    if (failGetKinds.has(kind)) throw new Error("dummy read failure");
    reads.push(kind);
    return kind === "session" ? token : master;
  },
  keychainSet: async (kind: string, value: string) => {
    if (kind === "session") token = value;
    else master = value;
  },
  keychainDelete: async (kind: string) => {
    if (failDelete) throw new Error("dummy delete failure");
    if (kind === "session") token = undefined;
    else master = undefined;
  },
}));
mock.module("../../src/touchid.ts", () => ({
  authenticate: async () => {
    authCalls++;
    return true;
  },
}));
mock.module("../../src/bw.ts", () => ({
  bw: async (args: string[]) => {
    bwCalls.push(args);
    return "dummy session";
  },
  bwJson: async () => {
    await duringFetch?.();
    return [];
  },
  bwDetached: () => undefined,
  BwError: class extends Error {},
  encode: (value: unknown) => JSON.stringify(value),
}));
mock.module("../../src/clipboard.ts", () => ({
  passwordsOffClipboard: () => process.env.no_clipboard === "1",
  copySecret: async () => {
    effects.push("copy");
    return 1;
  },
  copyText: async () => {
    effects.push("copy");
  },
  scheduleClear: () => undefined,
}));
mock.module("../../src/keys.ts", () => ({
  typeText: async () => {
    effects.push("type");
  },
  pressPaste: async () => {
    effects.push("paste");
  },
  pressKey: async () => {
    effects.push("key");
  },
  sleep: async () => undefined,
}));

const captureOutput = async (fn: () => Promise<void>): Promise<string> => {
  const out: string[] = [];
  const write = process.stdout.write;
  process.stdout.write = ((value: string | Uint8Array) => {
    out.push(String(value));
    return true;
  }) as typeof write;
  try {
    await fn();
  } finally {
    process.stdout.write = write;
  }
  return out.join("");
};

try {
  const session = await import("../../src/session.ts");
  const { publicEnv } = await import("../../src/proc.ts");
  const { post } = await import("../../src/commands/post.ts");
  const { genCopy } = await import("../../src/commands/generator.ts");
  const { sendCreate, sendCopy } = await import("../../src/commands/sends.ts");
  const { authCopy, authTick } = await import("../../src/commands/authenticator.ts");
  const { fetchVault } = await import("../../src/vault.ts");
  const bind = () => Object.assign(process.env, session.windowBinding());
  // Defaults, whitelist and timeout parsing.
  delete process.env.quick_unlock;
  delete process.env.vault_timeout;
  assert.equal(session.quickUnlockMode(), "off");
  assert.equal(session.vaultTimeoutMs(), 15 * 60_000);
  process.env.quick_unlock = "system"; // unknown values must count as Off, never as "authenticated"
  assert.equal(session.quickUnlockMode(), "off");
  process.env.quick_unlock = "off";
  process.env.vault_timeout = "-5";
  assert.equal(session.vaultTimeoutMs(), 15 * 60_000);
  process.env.vault_timeout = "0";
  assert.equal(session.vaultTimeoutMs(), 0);
  process.env.vault_timeout = "1";

  // Disabled quick unlock is refused without prompting or reading the saved master.
  master = "dummy old master";
  await assert.rejects(session.quickUnlock(), /turned off/);
  process.env.quick_unlock = "system";
  await assert.rejects(session.quickUnlock(), /turned off/);
  assert.equal(authCalls, 0);
  assert(!reads.includes("master"));
  process.env.quick_unlock = "off";

  // Opening the unlock sheet in Off removes a leftover saved master.
  assert.equal(await session.canQuickUnlock(), false);
  assert.equal(master, undefined);

  // Unlocking starts a new generation; Off leaves no saved master.
  master = "dummy old master";
  await session.unlock("dummy master");
  assert.equal(master, undefined);
  assert(session.readState().sessionId);
  assert(session.verifyMaster("dummy master"));
  assert.equal(await session.getSession(false), "dummy session");

  // A session key without a generation is not a valid session.
  const generation = session.readState().sessionId;
  session.writeState({ sessionId: undefined });
  assert.equal(await session.getSession(false), undefined);
  session.writeState({ sessionId: generation });

  // Lock clears the verifier, grace period and generation.
  session.writeState({ repromptedAt: Date.now() });
  await session.lock();
  const after = session.readState();
  assert.equal(after.masterHash, undefined);
  assert.equal(after.repromptedAt, undefined);
  assert.equal(after.sessionId, undefined);
  assert.equal(token, undefined);

  // A failed Keychain deletion still leaves the vault locked, and is reported.
  await session.unlock("dummy master");
  failDelete = true;
  await assert.rejects(session.lock(), /dummy delete failure/);
  assert.equal(await session.getSession(false), undefined);
  failDelete = false;

  // A failing Keychain read must not stop the generation clear or the deletion attempt.
  await session.unlock("dummy master");
  failGetKinds.add("session");
  await assert.rejects(session.lock(), /dummy read failure/);
  failGetKinds.clear();
  assert.equal(session.readState().sessionId, undefined);
  assert.equal(token, undefined);

  // PIN: too many failures block even the correct PIN; forgetting invalidates the PIN first.
  process.env.quick_unlock = "pin";
  session.setPin("1234");
  session.writeState({ pinFails: 5 });
  master = "dummy saved master";
  reads.length = 0;
  await assert.rejects(session.quickUnlock("1234"), /Too many/);
  assert(!reads.includes("master"));
  failDelete = true;
  await assert.rejects(session.forgetQuickUnlock(), /dummy delete failure/);
  assert.equal(session.readState().pinHash, undefined);
  failDelete = false;
  process.env.quick_unlock = "off";

  // Windows are bound to the unlock and account they loaded under.
  await session.unlock("dummy master");
  bind();
  assert.equal(await session.windowValid(), true);
  const before = session.readState().lastUsed;
  await session.windowValid();
  assert.equal(session.readState().lastUsed, before); // validity checks never extend the timeout
  const bound = process.env.window_account;
  process.env.window_account = "12345678";
  assert.equal(await session.windowValid(), false); // another account
  process.env.window_account = bound;
  process.env.auth_entries = JSON.stringify([{ id: "dummy", seed: "JBSWY3DPEHPK3PXP" }]);
  process.env.send_urls = JSON.stringify({ dummy: "https://example.invalid/send" });
  assert.equal(await session.windowValid(), true);
  await session.lock();
  assert.equal(await session.windowValid(), false); // locked
  assert.equal(await session.getSession(false), undefined);
  const tick = (await authTick()) as { finish?: unknown; variables?: Record<string, string> };
  assert.equal(tick.variables?.auth_entries, ""); // stale window drops its codes
  await authCopy(["dummy"]);
  await sendCopy(["dummy"]);
  assert.deepEqual(effects, []);
  // A new unlock is a new generation: the old window stays invalid.
  await session.unlock("dummy master");
  assert.equal(await session.windowValid(), false);
  bind();

  // Footer TOTP codes come only from windows that still belong to the current unlock.
  const { selected } = await import("../../src/commands/search.ts");
  const { toMeta } = await import("../../src/vault.ts");
  writeFileSync(
    join(temp, "cache.json"),
    JSON.stringify({
      syncedAt: 0,
      folders: [],
      items: [
        toMeta({
          id: "login",
          name: "Test",
          type: 1,
          folderId: null,
          favorite: false,
          reprompt: 0,
          notes: null,
        }),
      ],
    }),
  );
  process.env.totp_display = "footer";
  process.env.totp_seeds = JSON.stringify({ login: "JBSWY3DPEHPK3PXP" });
  assert.match(JSON.stringify(await selected(["login"])), /\d{3} \d{3}/);
  await session.lock();
  assert.doesNotMatch(JSON.stringify(await selected(["login"])), /\d{3} \d{3}/);
  rmSync(join(temp, "cache.json"));
  await session.unlock("dummy master");
  bind();

  // A refresh that spans a lock or an account change is discarded, and writes no cache.
  duringFetch = () => session.lock();
  await assert.rejects(fetchVault("dummy session"), /changed or locked/);
  duringFetch = undefined;
  assert(!existsSync(join(temp, "cache.json")));
  await assert.rejects(fetchVault("dummy session"), /locked/); // nothing unlocked at all
  const { loadVaultData, getItem } = await import("../../src/vault.ts");
  await session.unlock("dummy master");
  await fetchVault("dummy session"); // writes the encrypted cache while unlocked
  const gen = session.readState().sessionId;
  session.writeState({ sessionId: undefined }); // a lock that raced this read
  await assert.rejects(loadVaultData("dummy session"), /locked/); // the cached copy must not be served
  await assert.rejects(getItem("dummy session", "x"), /locked/);
  session.writeState({ sessionId: gen });
  await assert.rejects(fetchVault("some other session"), /changed or locked/); // not the live session

  // Clipboard-free mode never falls back to the clipboard; windows must be current.
  await session.unlock("dummy master");
  bind();
  process.env.no_clipboard = "1";

  // `post` is a separate Run Script: it sees only the variables `finish` hands over, so the
  // window binding must travel with the fill. Simulate that exactly.
  const { itemCommand } = await import("../../src/commands/item.ts");
  writeFileSync(
    join(temp, "cache.json"),
    JSON.stringify({
      syncedAt: 0,
      folders: [],
      items: [
        toMeta({
          id: "login",
          name: "Test",
          type: 1,
          folderId: null,
          favorite: false,
          reprompt: 0,
          notes: null,
        }),
      ],
    }),
  );
  process.env.fill_data = JSON.stringify({ login: { u: "dummy", p: "dummy-ascii", t: "" } });
  const handoff = (await itemCommand(["fill", "login"])) as { finish: { variables: Record<string, string> } };
  assert.equal(handoff.finish.variables.fill_ready, "1");
  for (const key of ["window_session", "window_account", "fill_data", "fill_ready", "fill_u", "fill_p"])
    delete process.env[key];
  Object.assign(process.env, handoff.finish.variables);
  effects.length = 0;
  await captureOutput(post);
  assert.deepEqual(effects, ["type", "key", "type"]); // typed: the handed-over binding was accepted
  effects.length = 0;
  delete process.env.window_session; // without the binding, post must refuse
  assert.match(await captureOutput(post), /changed or locked/);
  assert.deepEqual(effects, []);
  rmSync(join(temp, "cache.json"));
  bind();
  process.env.generated = "dummy-generated";
  await genCopy(["copy"]);
  assert.deepEqual(effects, []);
  const typed = await genCopy(["paste"]);
  assert.equal((typed.finish as { variables: Record<string, string> }).variables.bw_out, "type");
  assert.equal((typed.finish as { variables: Record<string, string> }).variables.type_generated, "1");

  process.env.bw_out = "fill";
  process.env.fill_ready = "1";
  process.env.fill_u = "dummy";
  process.env.fill_p = "non-ASCII \u{1F512}";
  assert.match(await captureOutput(post), /ASCII/);
  assert.deepEqual(effects, []); // neither field typed, nothing copied
  process.env.fill_p = "dummy-ascii";
  await captureOutput(post);
  assert.deepEqual(effects, ["type", "key", "type"]);
  effects.length = 0;
  await session.lock();
  assert.match(await captureOutput(post), /changed or locked/); // stale window fill
  process.env.bw_out = "type";
  process.env.type_value = "dummy-typed";
  assert.match(await captureOutput(post), /changed or locked/);
  assert.deepEqual(effects, []);

  // Password-protected file Sends are refused before the CLI is called.
  await session.unlock("dummy master");
  bwCalls.length = 0;
  process.env.secret_input = "dummy-send-password";
  const rejected = await sendCreate(["file", "dummy", "7", "", "false", "/tmp/dummy"]);
  assert.match(JSON.stringify(rejected), /process arguments/);
  assert.equal(bwCalls.filter((args) => args[0] === "send").length, 0);

  // Secret-bearing variables are not inherited by unrelated children.
  Object.assign(process.env, {
    BW_PASSWORD: "dummy",
    BW_SESSION: "dummy",
    DYLD_INSERT_LIBRARIES: "dummy",
    NODE_OPTIONS: "dummy",
    totp_seeds: "dummy",
    send_text: "dummy",
  });
  const env = publicEnv();
  for (const key of [
    "BW_PASSWORD",
    "BW_SESSION",
    "DYLD_INSERT_LIBRARIES",
    "NODE_OPTIONS",
    "secret_input",
    "fill_p",
    "auth_entries",
    "totp_seeds",
    "type_value",
    "send_text",
    "generated",
  ])
    assert.equal(env[key], undefined, key);
  assert(env.PATH);
  console.log("Passed isolated security regressions; no OS authentication or real credentials used");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
