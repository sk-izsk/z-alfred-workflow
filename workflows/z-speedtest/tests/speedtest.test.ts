import { afterAll, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyEvent, describeFailure, emptyState, lineReader } from "../src/model.ts";
import { dashboardHTML, detailHTML, rows } from "../src/presentation.ts";
import { dashboardSvg } from "../src/charts.ts";
import { qualities, speedToString } from "../src/utils.ts";
import { body, speedtestWindow } from "../ui/window.ts";

const root = mkdtempSync(join(tmpdir(), "speedtest-tests-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const finalEvent = () => ({
  ...emptyState().result,
  type: "result",
  isp: "Example ISP",
  download: {
    bandwidth: 45_000_000,
    bytes: 1_000_000,
    elapsed: 100,
    latency: { iqm: 9, low: 5, high: 10, jitter: 1 },
  },
  upload: {
    bandwidth: 50_000_000,
    bytes: 1_000_000,
    elapsed: 100,
    latency: { iqm: 9, low: 5, high: 10, jitter: 1 },
  },
  ping: { latency: 6.6, low: 5.5, high: 7.7, jitter: 1.5 },
  packetLoss: 0,
  result: { id: "demo", url: "https://www.speedtest.net/result/c/demo-123", persisted: true },
});
const completed = () => {
  const s = emptyState();
  applyEvent(s, finalEvent());
  return s;
};

describe("CLI parsing", () => {
  test("handles fragmented/coalesced JSON, CRLF, blank lines and final line without newline", () => {
    const s = emptyState(),
      reader = lineReader((event) => applyEvent(s, event));
    const stream =
      "\r\n" +
      JSON.stringify({ type: "download", download: { bandwidth: 123, progress: 0 } }) +
      "\r\n" +
      JSON.stringify(finalEvent());
    for (let i = 0; i < stream.length; i += 7) reader.push(stream.slice(i, i + 7));
    reader.end();
    expect(s.phase).toBe("done");
    expect(s.samples.download).toEqual([123]);
    expect(s.result.download.bandwidth).toBe(45_000_000);
  });
  test("merges partial latency and preserves progress zero", () => {
    const s = emptyState();
    applyEvent(s, { type: "download", download: { bandwidth: 12, progress: 0, latency: { low: 5 } } });
    applyEvent(s, { type: "download", download: { bandwidth: 13 } });
    expect(s.progress.download).toBe(0);
    expect(s.result.download.latency).toEqual({ iqm: 0, low: 5, high: 0, jitter: 0 });
    expect(dashboardSvg(s)).not.toMatch(/NaN|undefined/);
  });
  test("rejects malformed final output and ignores non-finite bandwidth", () => {
    const s = emptyState();
    expect(() => applyEvent(s, { type: "result" })).toThrow("Incomplete");
    applyEvent(s, { type: "download", download: { bandwidth: Infinity, latency: null } });
    expect(s.result.download.bandwidth).toBe(0);
    expect(() => lineReader(() => {}).push("oops\n")).toThrow();
  });
  test("reports offline, rate limits and actual failures", () => {
    expect(describeFailure("NoNetworkConnection", 1)).toContain("offline");
    expect(describeFailure("Too many requests", 1)).toContain("rate limit");
    expect(describeFailure("[date] [error] Cannot contact server", 1)).toContain("Cannot contact server");
  });
  test("rejects untrusted result URLs", () => {
    const s = emptyState();
    const event = finalEvent();
    event.result.url = "javascript:alert(1)";
    applyEvent(s, event);
    expect(s.result.result.url).toBe("");
  });
});

test("formats bandwidth and retains source activity thresholds", () => {
  expect(speedToString(45_000_000)).toBe("360.00 Mbps");
  expect(qualities(45_000_000, 50_000_000, "video")).toEqual(["480", "720", "1080", "4K"]);
  expect(qualities(10, 0, "voice")).toEqual([]);
});
test("all views handle partial data and escape CLI strings", () => {
  const s = completed();
  s.result.isp = '<script>alert("x")</script>';
  s.result.interface.isp = s.result.isp;
  for (const data of [emptyState(), s]) {
    for (const row of rows(data)) expect(detailHTML(data, row.uid)).not.toMatch(/NaN|undefined|<script>/);
    expect(dashboardHTML(data)).not.toMatch(/NaN|undefined|<script>/);
    expect(rows(data)).toHaveLength(9);
  }
  expect(dashboardHTML(s)).toContain("&lt;script&gt;");
  const tree = JSON.stringify(body(s, "list", true, "download"));
  expect(tree).toContain('"id":"results"');
  expect(tree).toContain('"id":"detail"');
});

const cliScript = (name: string, code: string): string => {
  const path = join(root, `${name}.mjs`);
  writeFileSync(
    path,
    `#!${process.execPath}\nif(process.argv.includes('--version')) { console.log('Speedtest by Ookla 1.2.0'); process.exit(0); }\n${code}`,
  );
  chmodSync(path, 0o755);
  return path;
};
const main = join(import.meta.dir, "..", "src", "main.ts");
const envFor = (dir: string, cli: string) => ({
  HOME: process.env.HOME!,
  PATH: "/usr/bin:/bin",
  alfred_workflow_cache: dir,
  speedtest_path: cli,
  appearance: "light",
});
const command = (env: Record<string, string>, name: string, session: string, arg = "") =>
  JSON.parse(execFileSync(process.execPath, [main, name, session, arg], { env, encoding: "utf8" }) || "{}");
const awaitState = async (dir: string, id: string, phase: string) => {
  for (let n = 0; n < 100; n++) {
    const s = JSON.parse(readFileSync(join(dir, "sessions", id, "state.json"), "utf8"));
    if (s.phase === phase) return s;
    await Bun.sleep(50);
  }
  throw new Error(`Test worker never reached ${phase}`);
};
test("worker and UI routes run in Alfred’s bare environment", async () => {
  const cli = cliScript("success", `console.log(${JSON.stringify(JSON.stringify(finalEvent()))});`);
  const cache = join(root, "success-cache"),
    env = envFor(cache, cli);
  const started = command(env, "start", "");
  const id = started.variables.session;
  const state = await awaitState(cache, id, "done");
  expect(state.result.isp).toBe("Example ISP");
  for (const name of [
    "poll",
    "view",
    "details",
    "actions",
    "copy-summary",
    "copy-section",
    "open",
    "filter",
    "select",
    "clear-confirm",
  ])
    expect(command({ ...env, mode: "list", details: "1" }, name, id, "ping")).toBeObject();
  expect(command(env, "copy-summary", id).copy.src).toContain("360.00 Mbps");
  const changed = command(env, "restart", id);
  expect(changed.variables.session).not.toBe(id);
  await awaitState(cache, changed.variables.session, "done");
  command(env, "clear", changed.variables.session);
  expect(existsSync(cli)).toBe(true);
  const rerun = command({ ...env, last_phase: "cleared" }, "primary", changed.variables.session);
  await awaitState(cache, rerun.variables.session, "done");
}, 15000);
test("worker reports CLI stderr and missing executable", async () => {
  for (const [name, cli, message] of [
    ["offline", cliScript("offline", "console.error('NoNetworkConnection');process.exit(1);"), "offline"],
    ["missing", join(root, "does-not-exist"), "not found"],
  ]) {
    const cache = join(root, `${name}-cache`),
      env = envFor(cache, cli!);
    const { variables } = command(env, "start", "");
    const state = await awaitState(cache, variables.session, "error");
    expect(state.errorMessage).toContain(message!);
    const restarted = command(env, "primary", variables.session);
    expect(restarted.variables.session).not.toBe(variables.session);
    await awaitState(cache, restarted.variables.session, "error");
  }
}, 15000);
test("closing cancels the CLI and releases the single-test lock", async () => {
  const marker = join(root, "cancelled"),
    cli = cliScript(
      "slow",
      `console.log(JSON.stringify({type:'ping',ping:{latency:1,progress:0}}));setTimeout(()=>{require('node:fs').writeFileSync(${JSON.stringify(marker)},'bad');},2000);`,
    );
  const cache = join(root, "cancel-cache"),
    env = envFor(cache, cli);
  const id = command(env, "start", "").variables.session;
  await awaitState(cache, id, "ping");
  command(env, "cancel", id);
  for (let i = 0; i < 100 && existsSync(join(cache, "running")); i++) await Bun.sleep(50);
  expect(existsSync(join(cache, "running"))).toBe(false);
  expect(existsSync(marker)).toBe(false);
}, 10000);

test("Back restores meter, detail visibility and selection without restarting the test", async () => {
  const cli = cliScript("navigation", `console.log(${JSON.stringify(JSON.stringify(finalEvent()))});`);
  const cache = join(root, "navigation-cache"),
    base = envFor(cache, cli);
  const started = command({ ...base, launch_view: "meter" }, "start", "");
  const id = started.variables.session;
  await awaitState(cache, id, "done");
  const stateFile = join(cache, "sessions", id, "state.json");
  const before = readFileSync(stateFile, "utf8");
  let env = { ...base, ...started.variables, speed_query: "ping", selection: "ping" };
  const step = (name: string) => {
    const result = command(env, name, id);
    env = { ...env, ...result.variables };
    return result;
  };
  expect(step("primary").variables.mode).toBe("list");
  expect(step("primary").variables.details).toBe("0");
  const details = step("back");
  expect(details).not.toHaveProperty("finish");
  expect(details.variables.mode).toBe("list");
  expect(details.variables.details).toBe("1");
  env.speed_query = "download";
  const meter = step("back");
  expect(meter).not.toHaveProperty("finish");
  expect(meter.variables.mode).toBe("meter");
  expect(meter.variables.selection).toBe("ping");
  expect(meter.update.ids.searchField.text).toBe("ping");
  expect(env.session).toBe(id);
  expect(readFileSync(stateFile, "utf8")).toBe(before);
  expect(step("back").finish.variables.speedtest_out).toBe("back");
  // Reopening a direct list starts a fresh history rather than inheriting the old window.
  const reopened = command({ ...base, launch_view: "list" }, "start", id);
  await awaitState(cache, reopened.variables.session, "done");
  expect(command({ ...base, ...reopened.variables }, "back", reopened.variables.session)).toHaveProperty(
    "finish",
  );
});
test("footer Back shares the history route, and a cache sheet returns to its parent", () => {
  const encoded = JSON.stringify(speedtestWindow);
  const bindings = encoded.match(/"shortcut":"\{var:back_shortcut\}"/g) || [];
  expect(bindings).toHaveLength(1);
  const find = (value: any, id: string): any => {
    if (!value || typeof value !== "object") return;
    if (value.id === id) return value;
    for (const child of Object.values(value)) {
      if (Array.isArray(child)) {
        for (const item of child) {
          const found = find(item, id);
          if (found) return found;
        }
      } else {
        const found = find(child, id);
        if (found) return found;
      }
    }
  };
  expect(find(JSON.parse(encoded), "footerBack").events[0].action.args[0]).toBe("back");
  const cache = join(root, "sheet-cache"),
    id = "11111111-1111-1111-1111-111111111111";
  const dir = join(cache, "sessions", id);
  mkdirSync(dir, { recursive: true });
  const s = emptyState();
  s.phase = "done";
  writeFileSync(join(dir, "state.json"), JSON.stringify(s));
  const sheet = command(envFor(cache, "/missing"), "clear-confirm", id);
  expect(JSON.stringify(sheet)).not.toContain('"finish"');
  expect(JSON.stringify(sheet)).toContain('"close":"clearSheet"');
});

test("meter updates a private local frame without reloading the animated document", async () => {
  const { meterDocument, updateMeter, meterClient } = await import("../src/meter.ts");
  const { Script } = await import("node:vm");
  expect(() => new Script(meterClient)).not.toThrow();
  const cache = join(root, "animation-cache"),
    id = "22222222-2222-2222-2222-222222222222";
  const saved = process.env.alfred_workflow_cache;
  process.env.alfred_workflow_cache = cache;
  try {
    mkdirSync(join(cache, "sessions", id), { recursive: true });
    const s = emptyState();
    s.phase = "download";
    s.result.download.bandwidth = 1250000;
    const path = updateMeter(id, s, true),
      document = readFileSync(path, "utf8");
    expect(document).toContain("requestAnimationFrame");
    expect(document).toContain("prefers-reduced-motion");
    expect(document).toContain("script-src 'nonce-");
    s.result.download.bandwidth = 62500000;
    s.result.isp = "</script><script>untrusted()</script>";
    updateMeter(id, s, false);
    expect(readFileSync(path, "utf8")).toBe(document);
    const frame = readFileSync(join(cache, "sessions", id, "meter-frame.js"), "utf8");
    expect(frame).not.toContain("<script>");
    const payload = JSON.parse(frame.slice("window.speedtestUpdate(".length, -2));
    expect(payload.running).toBe(true);
    expect(payload.html).toContain("500.00");
    s.phase = "done";
    updateMeter(id, s, false);
    expect(readFileSync(join(cache, "sessions", id, "meter-frame.js"), "utf8")).toContain('"running":false');
    expect(meterDocument(s)).toContain('data-running="0"');
  } finally {
    if (saved === undefined) delete process.env.alfred_workflow_cache;
    else process.env.alfred_workflow_cache = saved;
  }
});

test("connection failures render native controls instead of a web view", () => {
  const s = emptyState();
  s.phase = "error";
  s.errorMessage = "Connection failed";
  const tree = JSON.stringify(body(s, "meter", false, ""));
  expect(tree).not.toContain("webkitview");
  expect(tree).toContain("Connection failed");
});
