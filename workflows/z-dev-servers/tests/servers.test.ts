import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { listeners, processes, sameIdentity, restartPlan, quote, type Server } from "../src/servers.ts";
import { launchInput } from "../src/navigation.ts";
test("listener parser deduplicates IPv4/IPv6 and rejects invalid ports", () => {
  expect(listeners("p123\nn*:3000\nn[::1]:3000\nn*:99999")).toEqual([{ pid: 123, port: 3000 }]);
});
test("process identity includes start time, executable, directory and port", () => {
  const p = processes(" 123 Wed Nov 25 11:22:33 2026 /usr/local/bin/node app.js")[0]!;
  expect(p.pid).toBe(123);
  expect(p.command).toBe("/usr/local/bin/node app.js");
  const s: Server = {
    ...p,
    cwd: "/tmp/project",
    project: "project",
    framework: "Other",
    port: 3000,
    id: "123:3000",
    url: "http://localhost:3000",
  };
  expect(sameIdentity(s, { ...s, started: "changed" })).toBe(false);
  expect(sameIdentity(s, { ...s, cwd: "/other" })).toBe(false);
  expect(sameIdentity(s, { ...s })).toBe(true);
  const root = mkdtempSync(join(tmpdir(), "dev-server-test-"));
  try {
    writeFileSync(join(root, "package.json"), JSON.stringify({ scripts: { dev: "vite" } }));
    writeFileSync(join(root, "bun.lock"), "");
    expect(restartPlan({ ...s, cwd: root })).toContain("bun run 'dev'");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  expect(quote("a'b")).toBe("'a'\\''b'");
});
test("Dev envelope only returns to the fixed Dev launcher", () => {
  const id = "12345678-1234-1234-1234-123456789abc";
  expect(
    launchInput(
      "dev:v1:" + Buffer.from(JSON.stringify({ returnTo: id, query: "test" })).toString("base64url"),
    ),
  ).toEqual({ returnTo: id, query: "test" });
});
