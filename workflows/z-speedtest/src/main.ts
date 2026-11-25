import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { body, run } from "../ui/window.ts";
import { cacheDir, str, writeJson } from "./env.ts";
import { emptyState, type State } from "./model.ts";
import { dashboardHTML, detailHTML, entries, rows, section, summary } from "./presentation.ts";
import { cancel, sessionDir, snapshot, worker } from "./runner.ts";
import { imageAction } from "./image.ts";

type Json = Record<string, unknown>;
const mode = () => str("mode", "meter");
const details = () => str("details", "1") === "1";
const selection = () => str("selection", "ping");
const busy = (s: State) => s.phase !== "done" && s.phase !== "error";
const render = (s: State, full = false, view = mode(), show = details(), selected = selection()): Json => ({
  variables: { last_phase: s.phase, mode: view, details: show ? "1" : "0", selection: selected },
  pulse: { interval: busy(s) ? 0.25 : 0 },
  ...(view === "list" && s.phase !== "error" ? { functions: { ids: { results: "filterdata" } } } : {}),
  update: {
    relayout: full,
    ids: {
      ...(full
        ? { body: { components: body(s, view, show, selected) } }
        : s.phase === "error" || view !== "list"
          ? { dashboard: { text: dashboardHTML(s) } }
          : {
              results: { data: { src: rows(s) } },
              ...(show ? { detail: { text: detailHTML(s, selected) } } : {}),
            }),
      primaryButton: {
        text:
          s.phase === "error"
            ? "Restart  ↩"
            : view === "list"
              ? `${show ? "Hide" : "Show"} Details  ↩`
              : "Show Detailed List  ↩",
      },
    },
  },
});
const begin = (previous: string): Json => {
  cancel(previous);
  const id = randomUUID(),
    dir = sessionDir(id),
    state = emptyState();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeJson(join(dir, "state.json"), state);
  const child = spawn(process.execPath, [process.argv[1]!, "worker", id], {
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.on("error", (error) => {
    state.phase = "error";
    state.errorMessage = error.message;
    writeJson(join(dir, "state.json"), state);
  });
  child.unref();
  const initial = str("launch_view");
  const result = render(state, true, ["meter", "list"].includes(initial) ? initial : mode());
  result.variables = { ...(result.variables as Json), session: id };
  return result;
};
const clearConfirmation = (): Json => ({
  sheet: {
    id: "clearSheet",
    closeonescape: true,
    root: {
      type: "view",
      shortcuts: [
        {
          shortcut: "{var:back_shortcut}",
          action: {
            type: "json",
            src: { sheet: { close: "clearSheet" }, finish: { variables: { speedtest_out: "back" } } },
          },
        },
      ],
      layout: "inline",
      direction: "vertical",
      padding: 24,
      spacing: 16,
      components: [
        { type: "label", text: "Clear CLI Cache?", font: { size: 18, weight: "semibold" } },
        {
          type: "label",
          text: "Clears this workflow’s test data and exported images. Your installed CLI is preserved.",
        },
        {
          type: "button",
          text: "Clear Cache",
          shortcut: "↩",
          events: [{ triggers: "actioned", action: run("clear") }],
        },
        {
          type: "button",
          text: "Back  {var:back_shortcut}",
          shortcut: "{var:back_shortcut}",
          events: [
            {
              triggers: "actioned",
              action: {
                type: "json",
                src: { sheet: { close: "clearSheet" }, finish: { variables: { speedtest_out: "back" } } },
              },
            },
          ],
        },
      ],
    },
  },
});
const item = (text: string, cmd: string, args: string[] = []) => ({ text, action: run(cmd, args, true) });
const actions = (s: State): Json => {
  return {
    popupmenu: {
      src: "actionsButton",
      menu: [
        item(
          mode() === "list" ? (details() ? "Hide Details\t↩" : "Show Details\t↩") : "Show Detailed List\t⌘L",
          mode() === "list" ? "details" : "view",
        ),
        ...(mode() === "list" ? [item("Show Speed Meter\t⌘L", "view")] : []),
        ...(s.result.result.url ? [item("Open Results in Browser\t⌥↩", "open")] : []),
        ...(!busy(s) ? [item("Restart\t⌘R", "restart")] : []),
        { type: "separator" },
        item("Copy Summary to Clipboard\t⌘C", "copy-summary"),
        item("Copy Section to Clipboard\t⇧⌘C", "copy-section"),
        { type: "separator" },
        item("Copy Meter Image\t⌘D", "image", ["copy"]),
        item("Paste Meter Image\t⇧⌘V", "image", ["paste"]),
        item("Save Meter Image to Downloads\t⇧⌘D", "image", ["save"]),
        ...(!busy(s) ? [{ type: "separator" }, item("Clear CLI Cache…\t⌃X", "clear-confirm")] : []),
      ],
    },
  };
};
const main = async (): Promise<Json | undefined> => {
  const [command = "poll", session = "", arg = ""] = process.argv.slice(2);
  if (command === "worker") {
    await worker(session);
    return;
  }
  if (command === "cancel") {
    cancel(session);
    return;
  }
  if (command === "post") {
    if (str("speedtest_out") === "back")
      execFileSync(
        "/usr/bin/osascript",
        ["-e", 'tell application id "com.runningwithcrayons.Alfred" to search ""'],
        { timeout: 5000 },
      );
    if (str("speedtest_out") === "paste")
      execFileSync(
        "/usr/bin/osascript",
        ["-e", 'tell application "System Events" to keystroke "v" using command down'],
        { timeout: 5000 },
      );
    return;
  }
  if (command === "start") return begin(session);
  if (command === "back") return { finish: { variables: { speedtest_out: "back" } } };
  if (!session) return {};
  const s = snapshot(session);
  if (command === "primary" && str("last_phase") === "cleared") return begin(session);
  switch (command) {
    case "back":
      return { finish: { variables: { speedtest_out: "back" } } };
    case "restart":
      return busy(s) ? {} : begin(session);
    case "poll":
      return render(s, s.phase === "error" && str("last_phase") !== "error");
    case "primary":
      if (s.phase === "error") return begin(session);
      return mode() === "list" ? render(s, true, "list", !details()) : render(s, true, "list");
    case "view":
      return render(s, true, mode() === "list" ? "meter" : "list");
    case "details":
      return render(s, true, "list", !details());
    case "filter":
      return mode() === "list" && s.phase !== "error"
        ? { functions: { ids: { results: "filterdata" } } }
        : {};
    case "select": {
      if (!entries.some(([id]) => id === arg)) return {};
      return {
        variables: { selection: arg },
        ...(details() ? { update: { ids: { detail: { text: detailHTML(s, arg) } } } } : {}),
      };
    }
    case "actions":
      return actions(s);
    case "copy-summary":
      return { copy: { type: "text", src: summary(s) } };
    case "copy-section":
      return {
        copy: { type: "text", src: JSON.stringify(mode() === "list" ? section(s, selection()) : s.result) },
      };
    case "open":
      return s.result.result.url ? { open: { type: "url", src: s.result.result.url } } : {};
    case "image":
      return imageAction(s, arg);
    case "clear-confirm":
      return busy(s) ? {} : clearConfirmation();
    case "clear": {
      if (busy(s)) return { sheet: { close: "clearSheet" } };
      // Remove only files owned by this workflow, never a separately installed executable.
      const root = cacheDir();
      if (existsSync(join(root, "running")))
        return {
          sheet: { close: "clearSheet" },
          update: {
            ids: { primaryButton: { text: "Wait for the running speed test before clearing cache" } },
          },
        };
      for (const entry of readdirSync(join(root, "sessions")))
        rmSync(join(root, "sessions", entry), { recursive: true, force: true });
      rmSync(join(root, "speedtest-meter.png"), { force: true });
      const cleared = emptyState();
      cleared.phase = "error";
      cleared.errorMessage = "Cache cleared. Press Return to run a new test.";
      mkdirSync(sessionDir(session), { recursive: true, mode: 0o700 });
      writeJson(join(sessionDir(session), "state.json"), cleared);
      return { sheet: { close: "clearSheet" }, ...render(cleared, true) };
    }
    default:
      throw new Error(`Unknown command: ${command}`);
  }
};
try {
  const result = await main();
  if (result) console.log(JSON.stringify(result));
} catch (error) {
  console.log(
    JSON.stringify({
      update: { ids: { primaryButton: { text: error instanceof Error ? error.message : String(error) } } },
    }),
  );
}
