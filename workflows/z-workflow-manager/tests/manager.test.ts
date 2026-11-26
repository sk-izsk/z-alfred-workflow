import { test, expect, afterAll } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newer, galleryEntries, combine, scan, removalTarget, installer, catalog } from "../src/catalog.ts";
import { repositoryEntries } from "../src/repository.ts";
import { components } from "../ui/window.ts";
import { create } from "../src/state.ts";
const root = mkdtempSync(join(tmpdir(), "wfman-test-")),
  cache = process.env.alfred_workflow_cache;
process.env.alfred_workflow_cache = join(root, "cache");
afterAll(() => {
  if (cache === undefined) delete process.env.alfred_workflow_cache;
  else process.env.alfred_workflow_cache = cache;
  rmSync(root, { recursive: true, force: true });
});
const gallery = {
  creators: {
    author: {
      workflows: {
        demo: {
          name: "Demo",
          bundleIDs: ["demo", "demo.old"],
          description: "Example",
          version: "2.10.0",
        },
      },
    },
  },
};
test("version ordering supports semver and dated versions without lexical guesses", () => {
  expect(newer("2.10.0", "2.9.9")).toBe(true);
  expect(newer("26.2", "26.1")).toBe(true);
  expect(newer("2.0", "2.0.0")).toBe(false);
  expect(newer("2.0-beta", "1.0")).toBe(false);
  expect(newer("1.0", "2.0")).toBe(false);
});
test("bundle IDs match installs; alternate IDs do not create false Not Installed rows", () => {
  const remote = galleryEntries(gallery),
    local = {
      ...remote[0]!,
      uid: "user.workflow.demo",
      version: "1.0",
      latest: "",
      path: "/tmp/demo",
      source: "unknown" as const,
    };
  const all = combine([local], remote);
  expect(all).toHaveLength(1);
  expect(all[0]!.latest).toBe("2.10.0");
  expect(installer(all[0]!)).toBe("alfred://gallery/workflow/author/demo/");
  expect(() => installer({ ...local, url: "https://evil.invalid/", source: "gallery" })).toThrow();
});
test("scan reads metadata only and removal validates the installed entry without resolving links", () => {
  const prefs = join(root, "prefs"),
    source = join(root, "repo");
  mkdirSync(prefs);
  mkdirSync(source);
  writeFileSync(
    join(source, "info.plist"),
    JSON.stringify({ bundleid: "demo", name: "Demo", version: "1.0" }),
  );
  const link = join(prefs, "user.workflow.demo");
  symlinkSync(source, link);
  const entry = scan(prefs)[0]!;
  expect(entry.development).toBe(true);
  expect(removalTarget(entry, prefs)).toBe(link);
  expect(existsSync(source)).toBe(true);
  expect(() => removalTarget({ ...entry, path: source }, prefs)).toThrow();
  expect(() => removalTarget({ ...entry, bundle: "changed" }, prefs)).toThrow();
});
test("repository releases choose newest namespaced stable asset and reject other hosts", () => {
  const release = (version: string) => ({
    tag_name: `z-weather/v${version}`,
    html_url: "https://github.com/sk-izsk/z-alfred-workflow/releases/tag/test",
    assets: [
      {
        name: "Weather.alfredworkflow",
        browser_download_url: `https://github.com/sk-izsk/z-alfred-workflow/releases/download/z-weather%2Fv${version}/Weather.alfredworkflow`,
      },
    ],
  });
  const entries = repositoryEntries([
    release("0.9.0"),
    release("0.10.0"),
    { ...release("99.0.0"), prerelease: true },
  ]);
  expect(entries.find((e) => e.bundle === "com.izsk.weather")!.latest).toBe("0.10.0");
  expect(installer(entries[0]!)).toContain("github.com/sk-izsk/");
  expect(
    repositoryEntries([
      {
        ...release("1.0.0"),
        assets: [{ name: "Weather.alfredworkflow", browser_download_url: "https://evil.invalid/bad" }],
      },
    ]),
  ).toHaveLength(0);
});
test("catalog TTL avoids refetch; provider failures keep installed/Gallery usable and marked", async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      calls++;
      return new Response(JSON.stringify(String(input).includes("alfred.app") ? gallery : []), {
        status: 200,
      });
    }) as typeof fetch;
    const first = await catalog(true);
    expect(first.stale).toBe(false);
    expect(first.entries.length).toBe(2);
    expect(calls).toBe(2);
    await catalog();
    expect(calls).toBe(2);
    globalThis.fetch = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const old = await catalog(true);
    expect(old.stale).toBe(true);
    expect(old.fetched).toBe(first.fetched);
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      if (String(input).includes("github")) throw new Error("rate limit");
      return new Response(JSON.stringify(gallery), { status: 200 });
    }) as typeof fetch;
    expect((await catalog(true)).stale).toBe(true);
    expect((await catalog()).stale).toBe(true);
  } finally {
    globalThis.fetch = previous;
  }
});
test("native UI exposes filters and visible Back, keeps typing state and IDs unique", () => {
  const s = create("demo");
  const tree = components(s);
  const ids: string[] = [];
  const visit = (v: any) => {
    if (!v || typeof v !== "object") return;
    if (v.id) ids.push(v.id);
    Object.values(v).forEach(visit);
  };
  visit(tree);
  expect(ids.length).toBe(new Set(ids).size);
  expect(JSON.stringify(tree)).toContain("Not installed");
  expect(JSON.stringify(components(s))).toContain('"text":"demo"');
  expect(JSON.stringify(tree)).toContain("Back  {var:back_label}");
});

test("command actions preserve query/filter and offer native removal review before changes", async () => {
  const { execFileSync } = await import("node:child_process");
  const { save, read } = await import("../src/state.ts");
  const s = create("demo");
  s.entries = galleryEntries(gallery);
  s.entries[0] = { ...s.entries[0]!, uid: "user.workflow.demo", path: "/tmp/fake", version: "1.0" };
  s.selected = "user.workflow.demo";
  save(s);
  const invoke = (cmd: string, ...args: string[]) =>
    JSON.parse(
      execFileSync(process.execPath, [join(import.meta.dir, "../src/main.ts"), cmd, s.id, ...args], {
        encoding: "utf8",
        env: { ...process.env, alfred_workflow_cache: join(root, "cache") },
      }),
    );
  const menu = invoke("menu", s.selected);
  expect(menu.popupmenu.menu.some((m: any) => (m.text || "").startsWith("Back"))).toBe(false);
  expect(menu.popupmenu.menu.some((m: any) => (m.text || "").startsWith("Open Configuration"))).toBe(true);
  const review = invoke("remove-review", s.selected);
  expect(review.sheet.id).toBe("removeSheet");
  expect(JSON.stringify(review)).toContain("Back  {var:back_label}");
  const q = invoke("query", "new query");
  expect(q.update.ids.root).toBeUndefined();
  expect(read(s.id).query).toBe("new query");
  invoke("filter", "available");
  expect(read(s.id).filter).toBe("available");
  const current = read(s.id);
  current.entries = [current.entries[0]!];
  current.query = "demo";
  current.filter = "available";
  save(current);
  const empty = invoke("populate");
  expect(empty.update.ids.items.placeholder).toContain("already installed");
  expect(empty.update.ids.copyButton.text).toContain("Show Installed");
  const reveal = invoke("activate", "");
  expect(reveal.update.ids.filter.selected).toBe("installed");
  expect(read(s.id).query).toBe("demo");
  expect(invoke("back").finish.variables.wfman_out).toBe("back");
});
