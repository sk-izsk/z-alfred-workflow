import { execFileSync } from "node:child_process";
import { create, save } from "../src/state.ts";
import { components } from "../ui/window.ts";
import { expect, test } from "bun:test";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  lstatSync,
  utimesSync,
  symlinkSync,
  rmSync,
  realpathSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  validate,
  clean,
  checkSimulators,
  simulatorDevices,
  cleanupArgs,
  cleanupCommand,
  type Cache,
} from "../src/caches.ts";
test("cleanup validates old configured artifacts, rejects symlinks and changed inode before invoking removal", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "dev-cache-test-"))),
    prior = process.env.project_roots;
  process.env.project_roots = root;
  process.env.artifact_days = "1";
  try {
    const path = join(root, ".next");
    mkdirSync(path);
    writeFileSync(join(path, "fixture"), "temporary");
    const old = new Date(Date.now() - 3 * 86400000);
    utimesSync(path, old, old);
    const s = lstatSync(path);
    const target: Cache = {
      id: path,
      name: ".next",
      path,
      category: "Project Artifacts",
      risk: "Review",
      bytes: 9,
      device: s.dev,
      inode: s.ino,
      kind: "artifact",
      note: "test",
      error: "",
    };
    await expect(validate(target)).resolves.toBeUndefined();
    let called = "";
    await clean([target], async (p) => {
      called = p;
    });
    expect(called).toBe(path);
    await expect(validate({ ...target, inode: s.ino + 1 })).rejects.toThrow("changed");
    await expect(validate({ ...target, kind: "known", risk: "Safe" })).rejects.toThrow("scope");
    const link = join(root, "node_modules");
    symlinkSync(path, link);
    await expect(validate({ ...target, path: link })).rejects.toThrow("changed");
    expect(lstatSync(path).isDirectory()).toBe(true);
  } finally {
    if (prior === undefined) delete process.env.project_roots;
    else process.env.project_roots = prior;
    delete process.env.artifact_days;
    rmSync(root, { recursive: true, force: true });
  }
});

test("simulator cleanup is restricted to reviewed unavailable device IDs", () => {
  const a = "11111111-1111-1111-1111-111111111111",
    b = "22222222-2222-2222-2222-222222222222";
  const devices = simulatorDevices({
    devices: {
      "iOS-18": [
        { udid: a, isAvailable: false },
        { udid: b, isAvailable: true },
      ],
    },
  });
  expect(() => checkSimulators([a], devices)).not.toThrow();
  expect(() => checkSimulators([b], devices)).toThrow("changed");
  expect(() => checkSimulators([a], [{ udid: a, isAvailable: true }])).toThrow("changed");
  expect(cleanupArgs("npm")).toEqual(["cache", "clean", "--force"]);
  expect(cleanupArgs("brew")).toEqual(["cleanup", "--prune=0"]);
  expect(() => cleanupArgs("arbitrary shell")).toThrow();
  const command = cleanupCommand({ kind: "simulator", simulatorIDs: [a] } as Cache);
  expect(command).toContain(a);
  expect(command).not.toContain("delete unavailable");
});

test("native cache results preserve counted groups, reference details and unavailable cleanup state", () => {
  const dir = mkdtempSync(join(tmpdir(), "dev-cache-ui-")),
    prior = process.env.alfred_workflow_cache;
  process.env.alfred_workflow_cache = dir;
  try {
    const s = create("", "");
    s.rows = [
      {
        id: "example",
        name: "Example Cache",
        path: "/example/cache",
        category: "Package Manager Caches",
        risk: "Safe",
        bytes: 1024,
        device: 0,
        inode: 0,
        kind: "known",
        note: "Example downloaded packages.",
        error: "",
        available: true,
      },
    ];
    save(s);
    const action = JSON.parse(
      execFileSync(process.execPath, [join(import.meta.dir, "../src/main.ts"), "query", s.id, ""], {
        encoding: "utf8",
        env: process.env,
      }),
    );
    expect(action.update.ids.items.data.src[0]["cacheGroupTotal.text"]).toBe("1 items — 1.0 KB");
    expect(action.update.ids.cacheDetails.text).toContain("# Example Cache");
    expect(action.update.ids.cacheDetails.text).toContain("**Clean command:**");
    expect(action.update.ids.primary.enabled).toBe(true);
    const review = JSON.parse(
      execFileSync(process.execPath, [join(import.meta.dir, "../src/main.ts"), "open", s.id, "example"], {
        encoding: "utf8",
        env: process.env,
      }),
    );
    expect(review.sheet.closeonescape).toBe(true);
    const footer = review.sheet.root.components[1];
    expect(footer.constraints.position).toBe("right");
    expect(footer.components[0].text).toContain("Back");
    expect(footer.components[1].shortcut).toBe("↩");
    expect(footer.components[1].bordered).toBe(false);
    s.rows[0]!.available = false;
    save(s);
    const disabled = JSON.parse(
      execFileSync(process.execPath, [join(import.meta.dir, "../src/main.ts"), "query", s.id, ""], {
        encoding: "utf8",
        env: process.env,
      }),
    );
    expect(disabled.update.ids.primary.enabled).toBe(false);
    expect(action.update.ids.filter.items[0].text).toBe("All (1)");
    expect(JSON.stringify(components())).not.toContain("webkitview");
    expect(action.update.ids.items.data.src.some((r: any) => "cacheSubtitle.text" in r)).toBe(false);
  } finally {
    if (prior === undefined) delete process.env.alfred_workflow_cache;
    else process.env.alfred_workflow_cache = prior;
    rmSync(dir, { recursive: true, force: true });
  }
});

const artifact = (path: string): Cache => {
  const s = lstatSync(path);
  return {
    id: path,
    name: ".next",
    path,
    category: "Project Artifacts",
    risk: "Review",
    bytes: 1,
    device: s.dev,
    inode: s.ino,
    kind: "artifact",
    note: "test",
    error: "",
  };
};

test("cleanup refuses young artifacts, artifacts outside project roots, protected roots and foreign commands", async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "dev-cache-guard-"))),
    outside = realpathSync(mkdtempSync(join(tmpdir(), "dev-cache-outside-"))),
    prior = process.env.project_roots;
  process.env.project_roots = root;
  process.env.artifact_days = "30";
  let removed = 0;
  const remove = async () => {
    removed++;
  };
  try {
    // Modified just now: younger than the 30-day artifact age.
    const young = join(root, ".next");
    mkdirSync(young);
    await expect(clean([artifact(young)], remove)).rejects.toThrow("scope");
    // Old enough, but not under a configured project root.
    const stray = join(outside, ".next");
    mkdirSync(stray);
    const old = new Date(Date.now() - 60 * 86400000);
    utimesSync(stray, old, old);
    await expect(clean([artifact(stray)], remove)).rejects.toThrow("scope");
    // An artifact name that isn't a known build folder.
    const src = join(root, "src");
    mkdirSync(src);
    utimesSync(src, old, old);
    await expect(clean([{ ...artifact(src), name: "src" }], remove)).rejects.toThrow("scope");
    // The home folder itself is never a cleanup target, whatever the row claims.
    const home = realpathSync(process.env.HOME || "/");
    await expect(clean([{ ...artifact(home), kind: "known", name: "Home" }], remove)).rejects.toThrow();
    // Container cleanup must name the real docker binary and a docker action.
    await expect(
      clean([{ ...artifact(root), kind: "command", action: "docker-prune", path: "/bin/sh" }], remove),
    ).rejects.toThrow("container");
    // One bad row stops the whole batch before anything is removed.
    const good = join(root, ".turbo");
    mkdirSync(good);
    utimesSync(good, old, old);
    await expect(validate({ ...artifact(good), name: ".turbo" })).resolves.toBeUndefined();
    await expect(clean([{ ...artifact(good), name: ".turbo" }, artifact(young)], remove)).rejects.toThrow();
    expect(removed).toBe(0);
    await expect(clean([], remove)).rejects.toThrow("No caches");
  } finally {
    if (prior === undefined) delete process.env.project_roots;
    else process.env.project_roots = prior;
    delete process.env.artifact_days;
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});
