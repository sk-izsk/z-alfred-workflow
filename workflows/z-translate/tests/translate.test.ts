import { test, expect, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { translate, parseTranslation, validLanguage, languages } from "../src/api.ts";
import { launchText } from "../src/input.ts";
import { create, save, read } from "../src/state.ts";
import { components, toolWindow } from "../ui/window.ts";
const root = mkdtempSync(join(tmpdir(), "translate-test-")),
  priorCache = process.env.alfred_workflow_cache,
  priorData = process.env.alfred_workflow_data;
process.env.alfred_workflow_cache = join(root, "cache");
process.env.alfred_workflow_data = join(root, "data");
afterAll(() => {
  if (priorCache === undefined) delete process.env.alfred_workflow_cache;
  else process.env.alfred_workflow_cache = priorCache;
  if (priorData === undefined) delete process.env.alfred_workflow_data;
  else process.env.alfred_workflow_data = priorData;
  rmSync(root, { recursive: true, force: true });
});
const raw = [
  [
    ["হ্যালো বিশ্ব", "Hello world"],
    [null, null, "hello biswa"],
  ],
  null,
  "en",
];
const invoke = (cmd: string, id: string, ...args: string[]) =>
  JSON.parse(
    execFileSync(process.execPath, [join(import.meta.dir, "../src/main.ts"), cmd, id, ...args], {
      encoding: "utf8",
      env: process.env,
    }),
  );
test("clipboard is read exactly once for an empty invocation; explicit text and opt-out win", () => {
  let reads = 0;
  const clipboard = () => {
    reads++;
    return "Copied text\nSecond line";
  };
  expect(launchText("", true, clipboard)).toBe("Copied text\nSecond line");
  expect(reads).toBe(1);
  expect(launchText("Typed text", true, clipboard)).toBe("Typed text");
  expect(launchText("", false, clipboard)).toBe("");
  expect(reads).toBe(1);
});
test("provider parsing keeps multi-sentence text, detected language and pronunciation separate", () => {
  const result = parseTranslation(raw, "Hello world", "bn");
  expect(result.text).toBe("হ্যালো বিশ্ব");
  expect(result.from).toBe("en");
  expect(result.pronunciation).toBe("hello biswa");
  expect(
    parseTranslation(
      [
        [
          ["One ", "a"],
          ["Two", "b"],
        ],
        null,
        "en",
      ],
      "a b",
      "fr",
    ).text,
  ).toBe("One Two");
  expect(() => parseTranslation({ error: "bad" }, "a", "en")).toThrow();
  expect(() => parseTranslation([[]], "a", "en")).toThrow();
});
test("reference language catalog includes Bengali and accepts Auto only as a source", () => {
  expect(validLanguage("bn")).toBe(true);
  expect(validLanguage("auto")).toBe(false);
  expect(validLanguage("auto", true)).toBe(true);
  expect(validLanguage("evil/lang")).toBe(false);
  expect(languages.length).toBeGreaterThan(200);
});
test("requests POST text, honor cache setting, surface 429 and reject invalid input before fetching", async () => {
  const prior = globalThis.fetch,
    previousMinutes = process.env.cache_minutes;
  let calls = 0;
  try {
    process.env.cache_minutes = "60";
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls++;
      expect(String(input)).not.toContain("Hello");
      expect(init?.method).toBe("POST");
      expect(String(init?.body)).toContain("q=Hello");
      return new Response(JSON.stringify(raw), { status: 200 });
    }) as typeof fetch;
    const first = await translate("Hello world", "auto", "bn");
    await translate("Hello world", "auto", "bn");
    expect(calls).toBe(1);
    expect(first.to).toBe("bn");
    await translate("Hello world", "auto", "bn", true);
    expect(calls).toBe(2);
    globalThis.fetch = (async () => new Response("", { status: 429 })) as unknown as typeof fetch;
    await expect(translate("Hello world", "auto", "bn", true)).rejects.toThrow("rate limiting");
    await expect(translate("x".repeat(5001), "auto", "bn")).rejects.toThrow("4,500");
    await expect(translate("text", "xx-not-supported", "bn")).rejects.toThrow("supported");
  } finally {
    globalThis.fetch = prior;
    if (previousMinutes === undefined) delete process.env.cache_minutes;
    else process.env.cache_minutes = previousMinutes;
  }
});
test("native split panes have both pickers, editable original and selectable output without duplicate IDs", () => {
  const s = create("Hello world"),
    tree = components(s),
    ids: string[] = [];
  const visit = (v: any) => {
    if (!v || typeof v !== "object") return;
    if (v.id) ids.push(v.id);
    Object.values(v).forEach(visit);
  };
  visit(tree);
  expect(ids.length).toBe(new Set(ids).size);
  expect(ids).toContain("fromPicker");
  expect(ids).toContain("toPicker");
  expect(ids).toContain("originalText");
  expect(ids).toContain("resultText");
  expect(JSON.stringify(tree)).toContain('"editable":false');
  expect(JSON.stringify(toolWindow)).toContain("Back  {var:back_label}");
});
test("typing clears the old result and queues translation without replacing or refocusing the editor", () => {
  const s = create("Old text");
  s.result = parseTranslation(raw, "Old text", "bn");
  save(s);
  const action = invoke("query", s.id, "New text");
  expect(action.update.ids.root).toBeUndefined();
  expect(action.update.ids.originalText).toBeUndefined();
  expect(action.update.ids.resultText.text).toBe("");
  expect(action.pulse.args[0]).toBe("translate");
  expect(read(s.id).result).toBeUndefined();
  const oldTicket = s.request;
  expect(invoke("translate", s.id, oldTicket)).toEqual({});
  expect(invoke("back", s.id).finish.variables.trns_out).toBe("back");
  const menu = invoke("menu", s.id);
  expect(menu.popupmenu.menu.some((m: any) => m.text?.startsWith("Back"))).toBe(false);
  expect(menu.popupmenu.menu.some((m: any) => m.text === "Use Clipboard")).toBe(true);
});
test("swap uses the detected language and output text; copying uses the latest completed result", () => {
  const s = create("Hello world");
  s.to = "bn";
  s.result = parseTranslation(raw, "Hello world", "bn");
  save(s);
  expect(invoke("copy", s.id, s.query).copy.src).toBe("হ্যালো বিশ্ব");
  expect(invoke("copy", s.id, "Still typing").update.ids.statusLabel.text).toContain("Text changed");
  const swapped = invoke("swap", s.id);
  expect(swapped.update.ids.originalText.text).toBe("হ্যালো বিশ্ব");
  expect(read(s.id).from).toBe("bn");
  expect(read(s.id).to).toBe("en");
  expect(read(s.id).result).toBeUndefined();
});

test("long input splits without losing Unicode or paragraph breaks and enforces the 50,000-character bound", async () => {
  const { splitText, characterCount, CHUNK_CHARACTERS } = await import("../src/chunks.ts");
  const text = ("A paragraph with words.\n\n" + "😀".repeat(100) + "\n").repeat(200),
    parts = splitText(text);
  expect(parts.length).toBeGreaterThan(1);
  expect(parts.join("")).toBe(text);
  expect(parts.every((p) => characterCount(p) <= CHUNK_CHARACTERS)).toBe(true);
  expect(parts.some((p) => p.endsWith("\n"))).toBe(true);
  expect(splitText("a".repeat(50000)).join("")).toHaveLength(50000);
  expect(() => splitText("a".repeat(50001))).toThrow("50,000");
  expect(
    splitText("😀".repeat(50000))
      .map(characterCount)
      .reduce((a, b) => a + b, 0),
  ).toBe(50000);
});

test("long-text progress and Continue retain completed parts and only enable copying on completion", async () => {
  const { createHash } = await import("node:crypto"),
    { writeJson, cacheDir } = await import("../src/env.ts");
  const { splitText } = await import("../src/chunks.ts");
  const s = create("");
  s.to = "bn";
  save(s);
  const text = "First paragraph. ".repeat(400),
    parts = splitText(text),
    previous = process.env.cache_minutes;
  process.env.cache_minutes = "60";
  try {
    parts.forEach((part, i) => {
      const key = createHash("sha256")
        .update(JSON.stringify([part.trim(), s.from, s.to]))
        .digest("hex");
      writeJson(join(cacheDir(), `translation-${key}.json`), {
        text: `Translated part ${i + 1}`,
        original: part.trim(),
        pronunciation: "",
        from: "en",
        to: "bn",
        fetched: Date.now(),
      });
    });
    const queued = invoke("query", s.id, text),
      ticket = queued.pulse.args[2];
    expect(parts).toHaveLength(2);
    const first = invoke("translate", s.id, ticket);
    expect(first.update.ids.copyButton.enabled).toBe(false);
    expect(first.update.ids.resultText.text).toContain("Translated part 1");
    expect(read(s.id).job!.done).toHaveLength(1);
    const interrupted = read(s.id);
    interrupted.job!.failed = true;
    interrupted.error = true;
    save(interrupted);
    expect(invoke("menu", s.id).popupmenu.menu.some((m: any) => m.text === "Continue Translation")).toBe(
      true,
    );
    const resumed = invoke("continue", s.id);
    expect(read(s.id).job!.done).toHaveLength(1);
    expect(resumed.pulse.args[2]).not.toBe(ticket);
    expect(invoke("translate", s.id, ticket)).toEqual({});
    const complete = invoke("translate", s.id, resumed.pulse.args[2]);
    expect(complete.update.ids.copyButton.enabled).toBe(true);
    expect(read(s.id).job).toBeUndefined();
    expect(read(s.id).result!.original).toBe(text);
    expect(read(s.id).result!.text).toContain("Translated part 2");
    const tooLong = invoke("query", s.id, "x".repeat(50001));
    expect(tooLong.pulse).toBeUndefined();
    expect(tooLong.update.ids.statusLabel.text).toContain("50,000");
  } finally {
    if (previous === undefined) delete process.env.cache_minutes;
    else process.env.cache_minutes = previous;
  }
});
