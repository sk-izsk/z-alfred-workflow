// Isolated subprocess: every OS/CLI/authentication boundary is stubbed; only dummy values.
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
let duringGet: (() => Promise<void>) | undefined; // runs once, inside the next session Keychain read
let listItems: unknown[] = []; // what `bw list items` returns
const forgotten: (string | undefined)[] = []; // accounts whose cache key was removed
const effects: string[] = [];
const failGetKinds = new Set<string>();
let woke = false; // pretend the Mac slept since the last use
let failPaste = false; // make the paste keystroke fail
const clears: number[] = []; // clipboard clears that were armed
const reads: string[] = [];
const bwCalls: string[][] = [];

mock.module("../../src/keychain.ts", () => ({
  keychainGet: async (kind: string) => {
    if (failGetKinds.has(kind)) throw new Error("dummy read failure");
    if (kind === "session" && duringGet) {
      const hook = duringGet;
      duringGet = undefined;
      await hook();
    }
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
let cacheKeyValue: Buffer | undefined = Buffer.alloc(32, 5); // undefined = Keychain unavailable
mock.module("../../src/cachekey.ts", () => ({
  cacheKey: () => cacheKeyValue,
  forgetCacheKey: (account?: string) => {
    forgotten.push(account);
  },
}));
mock.module("../../src/sleep.ts", () => ({ wokeSince: () => woke }));
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
  bwJson: async (args?: string[]) => {
    await duringFetch?.();
    if (args?.[1] === "items") return listItems;
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
  scheduleClear: (count: number) => {
    clears.push(count);
  },
}));
mock.module("../../src/keys.ts", () => ({
  typeText: async () => {
    effects.push("type");
  },
  pressPaste: async () => {
    if (failPaste) throw new Error("paste failed");
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

  // A Mac that slept or restarted since the last use locks the vault, unless the setting is off.
  woke = true;
  process.env.lock_on_sleep = "0";
  assert.equal(await session.getSession(false), "dummy session");
  delete process.env.lock_on_sleep;
  assert.equal(await session.getSession(false), undefined);
  assert.equal(session.readState().sessionId, undefined);
  assert.equal(token, undefined);
  woke = false;
  await session.unlock("dummy master");

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
  const { toMeta, writeCache } = await import("../../src/vault.ts");
  writeCache({
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
  });
  process.env.totp_display = "footer";
  process.env.totp_seeds = JSON.stringify({ login: "JBSWY3DPEHPK3PXP" });
  assert.match(JSON.stringify(await selected(["login"])), /\d{3} \d{3}/);
  await session.lock();
  assert.doesNotMatch(JSON.stringify(await selected(["login"])), /\d{3} \d{3}/);
  // A stale window's tick must also empty the rows, so no code stays on screen.
  const { tick: searchTick } = await import("../../src/commands/search.ts");
  const staleTick = JSON.stringify(await searchTick([]));
  assert.match(staleTick, /"src":\[\]/);
  assert.match(staleTick, /"totp_seeds":""/);
  rmSync(join(temp, "cache.json"));
  await session.unlock("dummy master");
  bind();

  // The item-name cache is encrypted at rest and fails closed.
  const { readCache } = await import("../../src/vault.ts");
  const cachePath = join(temp, "cache.json");
  const cacheMeta = toMeta({
    id: "login",
    name: "Distinctive Site Name",
    type: 1,
    folderId: null,
    favorite: false,
    reprompt: 0,
    notes: null,
  });
  const cacheBody = { syncedAt: 1, folders: [], items: [cacheMeta] };
  writeCache(cacheBody);
  const onDisk = readFileSync(cachePath);
  assert(!onDisk.toString("latin1").includes("Distinctive Site Name")); // not readable from the file
  assert.equal(readCache()?.items[0]?.name, "Distinctive Site Name"); // but readable with the key
  const flipped = Buffer.from(onDisk);
  flipped[flipped.length - 1] = (flipped.at(-1) ?? 0) ^ 1;
  writeFileSync(cachePath, flipped);
  assert.equal(readCache(), undefined); // tampering is detected
  writeFileSync(cachePath, JSON.stringify(cacheBody)); // an old plaintext cache
  assert.equal(readCache(), undefined);
  assert(!existsSync(cachePath)); // is thrown away
  cacheKeyValue = undefined; // Keychain unavailable: no cache, and never a plaintext one
  writeCache(cacheBody);
  assert(!existsSync(cachePath));
  cacheKeyValue = Buffer.alloc(32, 5);

  // The window binding is compared after the Keychain wait, so a lock and re-unlock during it cannot slip through.
  await session.unlock("dummy master");
  bind();
  duringGet = async () => {
    await session.lock();
    await session.unlock("dummy master");
  };
  assert.equal(await session.windowValid(), false);
  assert.equal(await session.windowValid(), false); // and the old window stays invalid afterwards
  bind();

  // Rebuilt rows hide their codes, so a folder change must clear the refresh token for the next tick.
  writeCache(cacheBody);
  const { folder, loadVault } = await import("../../src/commands/search.ts");
  assert.match(JSON.stringify(folder(["all"])), /"totp_period":""/);
  rmSync(cachePath);

  // A cache is written under the account it was fetched for, never whichever account is active later.
  writeCache(cacheBody, "otheracc");
  assert(existsSync(join(temp, "cache-otheracc.json")));
  assert(!existsSync(cachePath));
  assert.equal(readCache("otheracc")?.items[0]?.name, "Distinctive Site Name");
  assert.equal(readCache(), undefined);
  rmSync(join(temp, "cache-otheracc.json"));

  // With no Keychain key the vault just fetched is still shown, and nothing is written to disk.
  listItems = [
    {
      id: "fetched",
      name: "Only From Fetch",
      type: 1,
      folderId: null,
      favorite: false,
      reprompt: 0,
      notes: null,
      login: { username: "u", password: "p", uris: [] },
    },
  ];
  cacheKeyValue = undefined;
  const shown = JSON.stringify(await loadVault("dummy session", true));
  assert.match(shown, /Only From Fetch/);
  assert(!existsSync(cachePath));
  cacheKeyValue = Buffer.alloc(32, 5);
  listItems = [];

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
  writeCache({
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
  });
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

  // The clipboard clear is armed before a paste that can fail, so a failure never leaves a secret behind.
  process.env.no_clipboard = "0";
  const { genQuick } = await import("../../src/commands/generator.ts");
  failPaste = true;
  clears.length = 0;
  await assert.rejects(genQuick(), /paste failed/);
  assert.equal(clears.length, 1);
  clears.length = 0;
  process.env.bw_out = "fill";
  process.env.fill_ready = "1";
  process.env.fill_u = "dummy-user";
  process.env.fill_p = "dummy-pass";
  await session.unlock("dummy master");
  bind();
  await captureOutput(post); // the paste fails, post reports it
  assert(clears.length >= 1);
  failPaste = false;
  process.env.no_clipboard = "1";
  effects.length = 0;

  // Note fields are copied concealed (hidden from clipboard managers and cleared later) but stay readable.
  const { detailFields } = await import("../../src/commands/item.ts");
  const note = detailFields({ id: "n", name: "Note", type: 2, notes: "private note text" } as never).find(
    (field) => field.name === "Notes",
  );
  assert.equal(note?.concealCopy, true);
  assert.equal(note?.secret, false);

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
  // Logout finishes its cleanup even when the Keychain refuses to delete, and reports the failure.
  await session.unlock("dummy master");
  bwCalls.length = 0;
  forgotten.length = 0;
  failDelete = true;
  await assert.rejects(session.logout(), /dummy delete failure/);
  failDelete = false;
  assert(bwCalls.some((args) => args[0] === "logout")); // bw logout still ran
  assert.equal(forgotten.length, 1); // the cache key was still removed
  assert.equal(session.readState().loggedIn, undefined); // the state file was still removed
  console.log("Passed isolated security regressions; no OS authentication or real credentials used");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
