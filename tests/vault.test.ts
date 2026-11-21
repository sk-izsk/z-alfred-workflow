import { expect, test } from "bun:test";
import { DEFAULTS, generateArgs, localPassword } from "../src/commands/generator.ts";
import { baseDomain, hostOf, matchesSite } from "../src/uri.ts";
import { buildRows, type Cache, ItemType } from "../src/vault.ts";

const meta = (id: string, name: string, extra: Partial<Cache["items"][number]> = {}) => ({
  id,
  name,
  type: ItemType.Login,
  folderId: null,
  favorite: false,
  reprompt: 0 as const,
  username: "",
  uris: [],
  hasTotp: false,
  hasPassword: true,
  hasPasskey: false,
  brand: "",
  ...extra,
});

const cache: Cache = {
  syncedAt: 0,
  folders: [{ id: "dev", name: "Development" }],
  items: [
    meta("1", "Zeta"),
    meta("2", "Amazon", { favorite: true }),
    meta("3", "GitHub", { uris: ["https://github.com/login"], folderId: "dev" }),
  ],
};

test("site matching uses the base domain", () => {
  expect(hostOf("https://www.github.com/x")).toBe("github.com");
  expect(baseDomain("shop.example.co.uk")).toBe("example.co.uk");
  expect(matchesSite(["github.com"], "https://gist.github.com/me")).toBe(true);
  expect(matchesSite(["github.com"], "https://gitlab.com")).toBe(false);
});

test("rows: current site first, then favorites, then A→Z", () => {
  const rows = buildRows(cache, "all", "https://github.com");
  expect(rows.map((r) => r["rowTitle.text"])).toEqual(["GitHub", "Amazon", "Zeta"]);
  expect(rows[0]?.["rowSuggested.hidden"]).toBe(false);
  expect(rows[0]?.["rowFolder.text"]).toBe("Development");
});

test("folder filter", () => {
  expect(buildRows(cache, "dev").map((r) => r.uid)).toEqual(["3"]);
  expect(buildRows(cache, "none").map((r) => r.uid)).toEqual(["2", "1"]);
});

test("generator flags respect bw limits", () => {
  expect(generateArgs({ ...DEFAULTS, length: 2 })).toEqual(["-u", "-l", "-n", "--length", "5"]);
  expect(generateArgs({ ...DEFAULTS, type: "passphrase", words: 1, separator: "" })).toEqual([
    "--passphrase",
    "--words",
    "3",
    "--separator",
    "empty",
    "--capitalize",
    "--includeNumber",
  ]);
});

test("local passwords: right length, one of each chosen set, nothing else", () => {
  for (let i = 0; i < 200; i++) {
    const pw = localPassword({ ...DEFAULTS, length: 12, special: true });
    expect(pw).toHaveLength(12);
    expect(pw).toMatch(/[A-Z]/);
    expect(pw).toMatch(/[a-z]/);
    expect(pw).toMatch(/[0-9]/);
    expect(pw).toMatch(/[!@#$%^&*]/);
  }
  expect(localPassword({ ...DEFAULTS, upper: false, number: false, length: 8 })).toMatch(/^[a-z]{8}$/);
});

test("bw menu: commands match by word prefix, otherwise offer a vault search", async () => {
  const { rootItems } = await import("../src/commands/root.ts");
  expect(rootItems("auth")[0]?.title).toBe("Authenticator");
  expect(rootItems("lock")[0]?.title).toBe("Lock Vault");
  const git = rootItems("git");
  expect(git.at(-1)?.title).toBe("Search vault for “git”");
  expect(git.at(-1)?.arg).toBe("git");
});

test("bw menu: one Switch Account entry that drills into the account list", async () => {
  const { rootItems } = await import("../src/commands/root.ts");
  const top = rootItems("").map((i) => i.title);
  expect(top).toContain("Switch Account…");
  expect(top.some((t) => t.startsWith("Switch to"))).toBe(false);
  const sw = rootItems("switch")[0];
  expect(sw?.valid).toBe(false);
  expect(sw?.autocomplete).toBe("account ");
  expect(rootItems("account ").at(-1)?.title).toBe("Add Account…");
});

test("encrypted vault cache: readable only with the same session", async () => {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  // Fully sandboxed: own data + cache folders, so the default account is used.
  process.env.alfred_workflow_data = mkdtempSync(join(tmpdir(), "bwa-data-"));
  process.env.alfred_workflow_cache = mkdtempSync(join(tmpdir(), "bwa-"));
  const { secureCache, invalidateVault } = await import("../src/vault.ts");
  const vault = { items: [{ id: "1", name: "x", login: { password: "s3cret" } }] as never[], folders: [] };
  secureCache.write("session-A", vault);
  expect(secureCache.read("session-A")?.items).toHaveLength(1);
  expect(secureCache.read("session-B")).toBeUndefined();
  const raw = (await import("node:fs")).readFileSync(join(process.env.alfred_workflow_cache, "vault.enc"));
  expect(raw.includes("s3cret")).toBe(false);
  invalidateVault();
  expect(secureCache.read("session-A")).toBeUndefined();
});
