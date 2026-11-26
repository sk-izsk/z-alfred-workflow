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
import { validate, clean, type Cache } from "../src/caches.ts";
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
    expect(() => validate(target)).not.toThrow();
    let called = "";
    await clean([target], async (p) => {
      called = p;
    });
    expect(called).toBe(path);
    expect(() => validate({ ...target, inode: s.ino + 1 })).toThrow("changed");
    expect(() => validate({ ...target, kind: "known", risk: "Safe" })).toThrow("scope");
    const link = join(root, "node_modules");
    symlinkSync(path, link);
    expect(() => validate({ ...target, path: link })).toThrow("changed");
    expect(lstatSync(path).isDirectory()).toBe(true);
  } finally {
    if (prior === undefined) delete process.env.project_roots;
    else process.env.project_roots = prior;
    delete process.env.artifact_days;
    rmSync(root, { recursive: true, force: true });
  }
});
