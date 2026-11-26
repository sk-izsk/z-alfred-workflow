import { describe, expect, test } from "bun:test";
import {
  parseProcesses,
  parseCPU,
  parseMemory,
  filterProcesses,
  bytes,
  makePlan,
  sameProcess,
  validateTarget,
  type ProcessInfo,
  type Plan,
} from "../src/model.ts";
import { executePlan, type Driver } from "../src/operations.ts";
import { ancestors } from "../src/system.ts";
import { processWindow } from "../ui/window.ts";
import { infoPlist } from "../scripts/plist.ts";
import { sheet } from "../src/ui.ts";
const row = (patch: Partial<ProcessInfo> = {}): ProcessInfo => ({
  id: "400:Mon Nov 23 10:00:00 2026",
  pid: 400,
  ppid: 1,
  uid: 501,
  cpu: 3.5,
  memory: 104857600,
  started: "Mon Nov 23 10:00:00 2026",
  path: "/Applications/Example App.app/Contents/MacOS/Example App",
  name: "Example App",
  app: "/Applications/Example App.app",
  ...patch,
});
const driver = (rows: ProcessInfo[]) => {
  const signals: [number, string][] = [],
    opened: string[] = [];
  const io: Driver = {
    list: async () => rows,
    signal: (pid, signal) => {
      signals.push([pid, signal]);
    },
    open: async (app) => {
      opened.push(app);
    },
    sleep: async () => {},
  };
  return { io, signals, opened };
};
describe("macOS sampling", () => {
  test("ps preserves names and paths with spaces", () => {
    const rows = parseProcesses(
      "400 1 501 115.2 102400 Mon Nov 23 10:00:00 2026 /Applications/Example App.app/Contents/MacOS/Example App\ninvalid",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      pid: 400,
      cpu: 115.2,
      memory: 104857600,
      name: "Example App",
      app: "/Applications/Example App.app",
    });
  });
  test("CPU uses the last sample", () => {
    expect(
      parseCPU("CPU usage: 40.0% user, 20.0% sys, 40.0% idle\nCPU usage: 3.0% user, 7.0% sys, 90.0% idle"),
    ).toBe(10);
    expect(parseCPU("missing")).toBeNull();
  });
  test("RAM is active+wired+compressed with unknown on failure", () => {
    expect(
      parseMemory(
        "page size of 16384 bytes\nPages active: 100.\nPages wired down: 200.\nPages occupied by compressor: 300.",
        16384 * 1000,
      ),
    ).toMatchObject({ memory: 60, used: 16384 * 600 });
    expect(parseMemory("", 0).memory).toBeNull();
  });
  test("literal search, PID matching and descending sort", () => {
    const rows = [row(), row({ pid: 401, name: "Code Helper (Plugin)", cpu: 20, memory: 2e8 })];
    expect(filterProcesses(rows, "(Plugin)", "cpu")[0]?.pid).toBe(401);
    expect(filterProcesses(rows, "400 Example", "cpu")).toHaveLength(1);
    expect(filterProcesses(rows, "", "memory")[0]?.pid).toBe(401);
    expect(filterProcesses(rows, "/Applications", "cpu", false)).toHaveLength(0);
  });
  test("binary byte units", () => {
    expect(bytes(1024)).toBe("1.0 KiB");
    expect(bytes(1073741824)).toBe("1.0 GiB");
  });
});
describe("actions", () => {
  test("protects system processes, ancestors and other users", () => {
    for (const p of [
      row({ pid: 1 }),
      row({ uid: 0 }),
      row({ pid: 99 }),
      row({ path: "/System/Library/PrivateFrameworks/SkyLight.framework/Resources/WindowServer" }),
    ])
      expect(() => validateTarget(p, 501, new Set([99]))).toThrow();
  });
  test("Kill All matches the exact executable, not a search", () => {
    const p = row();
    expect(
      makePlan(
        "terminate-all",
        p,
        [p, row({ pid: 401 }), row({ pid: 402, path: "/tmp/Other Example" })],
        501,
        new Set(),
      ).targets.map((t) => t.pid),
    ).toEqual([400, 401]);
  });
  test("restart targets the app bundle but refuses background launch guesses", () => {
    const p = row();
    expect(
      makePlan("restart", p, [p, row({ pid: 401, path: p.app + "/Contents/Helpers/Helper" })], 501, new Set())
        .targets,
    ).toHaveLength(2);
    expect(() => makePlan("restart", row({ app: "" }), [row({ app: "" })], 501, new Set())).toThrow();
  });
  test("group planning rejects protected targets", () => {
    expect(() => makePlan("force-all", row(), [row(), row({ pid: 401, uid: 0 })], 501, new Set())).toThrow();
  });
  test("Kill uses SIGTERM and Force Kill uses SIGKILL", async () => {
    for (const op of ["terminate", "force"] as const) {
      const p = row(),
        d = driver([p]);
      await executePlan(makePlan(op, p, [p], 501, new Set()), d.io, 501, new Set());
      expect(d.signals).toEqual([[400, op === "force" ? "SIGKILL" : "SIGTERM"]]);
    }
  });
  test("PID reuse aborts before signaling", async () => {
    const p = row(),
      d = driver([row({ started: "Tue Nov 24 10:00:00 2026" })]);
    await expect(
      executePlan(makePlan("force", p, [p], 501, new Set()), d.io, 501, new Set()),
    ).rejects.toThrow("PID was reused");
    expect(d.signals).toEqual([]);
    expect(sameProcess(p, row({ path: "/tmp/replaced" }))).toBe(false);
  });
  test("preflights all targets before sending the first signal", async () => {
    const p = row(),
      d = driver([p, row({ pid: 401, uid: 0 })]);
    await expect(
      executePlan(makePlan("terminate-all", p, [p, row({ pid: 401 })], 501, new Set()), d.io, 501, new Set()),
    ).rejects.toThrow();
    expect(d.signals).toEqual([]);
  });
  test("new matching processes are not added after confirmation", async () => {
    const p = row(),
      d = driver([p, row({ pid: 401 })]);
    await executePlan(makePlan("terminate-all", p, [p], 501, new Set()), d.io, 501, new Set());
    expect(d.signals).toEqual([[400, "SIGTERM"]]);
  });
  test("expired and unknown plans cannot execute", async () => {
    const p = row(),
      d = driver([p]),
      plan = makePlan("terminate", p, [p], 501, new Set());
    await expect(executePlan({ ...plan, created: Date.now() - 61000 }, d.io, 501, new Set())).rejects.toThrow(
      "expired",
    );
    await expect(
      executePlan({ ...plan, operation: "shell" } as unknown as Plan, d.io, 501, new Set()),
    ).rejects.toThrow();
    expect(d.signals).toEqual([]);
  });
  test("restart waits for exit and opens the app once", async () => {
    const p = row(),
      d = driver([p]);
    let sent = false;
    d.io.signal = (pid, signal) => {
      d.signals.push([pid, signal]);
      sent = true;
    };
    d.io.list = async () => (sent ? [] : [p]);
    await executePlan(makePlan("restart", p, [p], 501, new Set()), d.io, 501, new Set());
    expect(d.opened).toEqual([p.app]);
  });
  test("permission errors do not reopen the app", async () => {
    const p = row(),
      d = driver([p]);
    d.io.signal = () => {
      throw new Error("EPERM");
    };
    await expect(
      executePlan(makePlan("restart", p, [p], 501, new Set()), d.io, 501, new Set()),
    ).rejects.toThrow("Could not signal");
    expect(d.opened).toEqual([]);
  });
  test("ancestor traversal handles loops", () => {
    expect([...ancestors([row({ pid: 400, ppid: 401 }), row({ pid: 401, ppid: 400 })], 400)]).toEqual([
      400, 401,
    ]);
  });
});
describe("native UI", () => {
  test("unique IDs with one Back shortcut binding", () => {
    const ids: string[] = [],
      back: string[] = [];
    const visit = (v: unknown): void => {
      if (!v || typeof v !== "object") return;
      if (Array.isArray(v)) {
        v.forEach(visit);
        return;
      }
      const o = v as Record<string, unknown>;
      if (typeof o.id === "string") ids.push(o.id);
      if (o.shortcut === "{var:back_shortcut}") back.push(String(o.id));
      Object.values(o).forEach(visit);
    };
    visit(processWindow);
    expect(new Set(ids).size).toBe(ids.length);
    expect(back).toEqual(["footerBack"]);
  });
  test("sheet Back closes only its parent", () => {
    const s = JSON.stringify(sheet("example", { type: "label", text: "Example" }));
    expect(s).toContain('"close":"example"');
    expect(s).not.toContain('"finish"');
    expect(s).toContain('"shortcut":"{var:back_shortcut}"');
  });
  test("native CPU/RAM bars and no background polling before launch", () => {
    const s = JSON.stringify(processWindow);
    expect(s).toContain('"id":"cpuBar"');
    expect(s).toContain('"id":"ramBar"');
    expect(s).not.toContain("webkitview");
    expect(processWindow.pulse.interval).toBe(0);
  });
  test("configurable keyword and external trigger", () => {
    expect(infoPlist.userconfigurationconfig.some((c) => c.variable === "kw_main")).toBe(true);
    expect(infoPlist.userconfigurationconfig.some((c) => c.variable === "back_shortcut")).toBe(true);
    expect(infoPlist.objects.some((o) => o.uid === "TRIGGER")).toBe(true);
  });
});

test("Actions contains every screenshot operation and Cancel invalidates the pending plan", async () => {
  const { mkdtempSync, rmSync, existsSync } = await import("node:fs");
  const { join, dirname } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const { execFileSync } = await import("node:child_process");
  const { create, save, planFile, selectionFile, windowFile } = await import("../src/state.ts");
  const { writeJson } = await import("../src/env.ts");
  const dir = mkdtempSync(join(tmpdir(), "plan-window-kill-test-")),
    old = process.env.alfred_workflow_cache;
  try {
    process.env.alfred_workflow_cache = dir;
    const state = create("Example", "cpu");
    state.rows = [row()];
    save(state);
    for (const file of [planFile(state.id), selectionFile(state.id), windowFile(state.id)])
      expect(dirname(file)).toBe(dir);
    const invoke = (...args: string[]) =>
      JSON.parse(
        execFileSync(process.execPath, [join(import.meta.dir, "../src/main.ts"), ...args], {
          encoding: "utf8",
          env: { HOME: process.env.HOME, PATH: "/usr/bin:/bin", alfred_workflow_cache: dir },
        }),
      );
    const menu = invoke("action", state.id, "menu", row().id).popupmenu.menu.map(
      (item: any) => item.text || "",
    );
    for (const title of [
      "Kill",
      "Force Kill",
      "Restart",
      "Force Restart",
      "Kill All",
      "Force Kill All",
      "Copy Path",
      "Reload",
    ])
      expect(menu.some((text: string) => text === title || text.startsWith(title + " "))).toBe(true);
    writeJson(planFile(state.id), makePlan("terminate", row(), [row()], 501, new Set()));
    expect(invoke("cancel", state.id)).toEqual({ sheet: { close: "confirmSheet" } });
    expect(existsSync(planFile(state.id))).toBe(false);
  } finally {
    if (old === undefined) delete process.env.alfred_workflow_cache;
    else process.env.alfred_workflow_cache = old;
    rmSync(dir, { recursive: true, force: true });
  }
});
