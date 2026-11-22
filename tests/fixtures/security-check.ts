// Isolated subprocess: every OS/CLI/authentication boundary is stubbed; only dummy values.
import assert from "node:assert/strict";
import { mock } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temp = mkdtempSync(join(tmpdir(), "bwa-security-"));
process.env.alfred_workflow_data = temp;
process.env.alfred_workflow_cache = temp;
process.env.vault_timeout = "1";
let token: string | undefined;
let master: string | undefined;
let authCalls = 0;
const effects: string[] = [];

mock.module("../../src/keychain.ts", () => ({
  keychainGet: async (kind: string) => (kind === "session" ? token : master),
  keychainSet: async (kind: string, value: string) => {
    if (kind === "session") token = value;
    else master = value;
  },
  keychainDelete: async (kind: string) => {
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
  bw: async () => "dummy session",
  bwJson: async () => ({}),
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

try {
  const session = await import("../../src/session.ts");
  const { publicEnv } = await import("../../src/proc.ts");
  const { post } = await import("../../src/commands/post.ts");
  const { genCopy } = await import("../../src/commands/generator.ts");
  const { sendCreate } = await import("../../src/commands/sends.ts");

  // Defaults: Off, 15 minutes.
  delete process.env.quick_unlock;
  delete process.env.vault_timeout;
  assert.equal(session.quickUnlockMode(), "off");
  assert.equal(session.vaultTimeoutMs(), 15 * 60_000);
  process.env.vault_timeout = "1";

  // Disabled quick unlock is refused without prompting or reading the saved master.
  master = "dummy old master";
  await assert.rejects(session.quickUnlock(), /turned off/);
  assert.equal(authCalls, 0);

  // Unlocking in Off mode removes an older saved master and starts a new generation.
  await session.unlock("dummy master");
  assert.equal(master, undefined);
  assert(session.readState().sessionId);
  assert(session.verifyMaster("dummy master"));

  // Lock clears the re-prompt verifier, grace period and generation.
  session.writeState({ repromptedAt: Date.now() });
  await session.lock();
  const after = session.readState();
  assert.equal(after.masterHash, undefined);
  assert.equal(after.repromptedAt, undefined);
  assert.equal(after.sessionId, undefined);
  assert.equal(token, undefined);

  // Clipboard-free mode never falls back to the clipboard.
  await session.unlock("dummy master");
  process.env.no_clipboard = "1";
  process.env.generated = "dummy-generated";
  await genCopy(["copy"]);
  assert.deepEqual(effects, []);
  const typed = await genCopy(["paste"]);
  assert.equal((typed.finish as { variables: Record<string, string> }).variables.bw_out, "type");

  process.env.bw_out = "fill";
  process.env.fill_ready = "1";
  process.env.fill_u = "dummy";
  process.env.fill_p = "non-ASCII \u{1F512}";
  const output: string[] = [];
  const write = process.stdout.write;
  process.stdout.write = ((value: string | Uint8Array) => {
    output.push(String(value));
    return true;
  }) as typeof write;
  try {
    await post();
  } finally {
    process.stdout.write = write;
  }
  assert.match(output.join(""), /ASCII/);
  assert.deepEqual(effects, []); // neither field typed, nothing copied

  // Password-protected file Sends are refused before the CLI is called.
  process.env.secret_input = "dummy-send-password";
  const rejected = await sendCreate(["file", "dummy", "7", "", "false", "/tmp/dummy"]);
  assert.match(JSON.stringify(rejected), /process arguments/);

  // Secret-bearing variables are not inherited by unrelated children.
  Object.assign(process.env, {
    BW_PASSWORD: "dummy",
    BW_SESSION: "dummy",
    DYLD_INSERT_LIBRARIES: "dummy",
    NODE_OPTIONS: "dummy",
    totp_seeds: "dummy",
    type_value: "dummy",
    send_text: "dummy",
    auth_entries: "dummy",
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
