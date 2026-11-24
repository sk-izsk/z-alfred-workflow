import { afterAll, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { applyEvent, describeFailure, emptyState, lineReader } from "../src/model.ts";
import { dashboardHTML, detailHTML, rows } from "../src/presentation.ts";
import { dashboardSvg } from "../src/charts.ts";
import { qualities, speedToString } from "../src/utils.ts";
import { body } from "../ui/window.ts";

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
