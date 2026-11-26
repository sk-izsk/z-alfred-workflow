import { test, expect, afterAll } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tools, envelope, available } from "../src/tools.ts";
import { create, save } from "../src/state.ts";
const temp = mkdtempSync(join(tmpdir(), "swiss-tests-")),
  old = process.env.alfred_workflow_cache;
process.env.alfred_workflow_cache = temp;
afterAll(() => {
  if (old === undefined) delete process.env.alfred_workflow_cache;
  else process.env.alfred_workflow_cache = old;
  rmSync(temp, { recursive: true, force: true });
});
const invoke = (cmd: string, id: string, ...args: string[]) =>
  JSON.parse(
    execFileSync(process.execPath, [join(import.meta.dir, "../src/main.ts"), cmd, id, ...args], {
      encoding: "utf8",
      env: process.env,
    }),
  );
test("registry is unique and requires Speed Test return-navigation version", () => {
  expect(new Set(tools.map((t) => t.id)).size).toBe(tools.length);
  const speed = tools.find((t) => t.id === "speedtest")!;
  expect(available(speed, [{ bundle: speed.bundle, version: "0.1.2" }])).toBe(false);
  expect(available(speed, [{ bundle: speed.bundle, version: "0.1.3" }])).toBe(true);
  expect(available(speed, [{ bundle: speed.bundle, version: "0.2.0" }])).toBe(true);
});
test("launch envelope carries only the validated session and query", () => {
  const id = "6b2e51b0-d9d1-41b8-a405-d24feafba521";
  expect(JSON.parse(Buffer.from(envelope(id, "100 km in miles").slice(9), "base64url").toString())).toEqual({
    returnTo: id,
    query: "100 km in miles",
  });
});
test("filter and selection persist; opening emits a handoff without executing a tool", () => {
  const s = create(
    "",
    tools.map((t) => ({ bundle: t.bundle, version: t.minimum })),
  );
  expect(
    invoke("query", s.id, "weather").update.ids.items.data.src.map((r: { uid: string }) => r.uid),
  ).toEqual(["weather"]);
  invoke("select", s.id, "weather");
  const opened = invoke("open", s.id, "weather");
  expect(opened.finish.variables).toMatchObject({
    swiss_out: "launch",
    swiss_tool: "weather",
    swiss_session: s.id,
  });
  const restored = invoke("populate", s.id);
  expect(restored.update.ids.items.select).toBe("weather");
  expect(invoke("back", s.id).finish.variables.swiss_out).toBe("back");
});
test("missing tool is not launched and Back is outside Actions", () => {
  const s = create("", []);
  save(s);
  expect(invoke("open", s.id, "weather").update.ids.statusLabel.text).toContain("Install/update");
  const names = invoke("menu", s.id, "weather").popupmenu.menu.map((m: { text: string }) => m.text);
  expect(names.some((text: string) => text.startsWith("Back"))).toBe(false);
});
