import { test, expect, afterAll } from "bun:test";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { normalize, results, enginePath } from "../src/engine.ts";
const root = mkdtempSync(join(tmpdir(), "calcany-tests-")),
  prior = { ...process.env };
for (const [key, value] of Object.entries({
  alfred_workflow_cache: join(root, "cache"),
  alfred_workflow_data: join(root, "data"),
  engine_path: root,
  php_path: join(root, "fake-php"),
}))
  process.env[key] = value;
afterAll(() => {
  for (const key of ["alfred_workflow_cache", "alfred_workflow_data", "engine_path", "php_path"]) {
    if (prior[key] === undefined) delete process.env[key];
    else process.env[key] = prior[key];
  }
  rmSync(root, { recursive: true, force: true });
});
writeFileSync(
  join(root, "info.plist"),
  '<?xml version="1.0"?><plist version="1.0"><dict><key>bundleid</key><string>com.alfred.calculateanything</string><key>userconfigurationconfig</key><array/></dict></plist>',
);
writeFileSync(join(root, "process.php"), "<?php");
mkdirSync(join(root, "vendor"));
writeFileSync(join(root, "vendor/autoload.php"), "<?php");
writeFileSync(
  join(root, "fake-php"),
  `#!${process.execPath}\nconst input=JSON.parse(await Bun.stdin.text());if(input.query!=="100 km in miles")process.exit(3);console.log(JSON.stringify({items:[{title:"62.137 mi",arg:"62.137",mods:{cmd:{arg:"62.137"},alt:{arg:"0.62137"}}}]}));\n`,
  { mode: 0o755 },
);
test("normalizes upstream copy variants and ignores nonactionable rows", () => {
  expect(
    normalize([
      { title: "Error", valid: false, arg: "bad" },
      { title: "x", arg: "2,000", mods: { cmd: { arg: "2000" }, alt: { arg: "20" } } },
    ]),
  ).toEqual([{ uid: "1", title: "x", subtitle: "", value: "2,000", raw: "2000", single: "20" }]);
});
test("arithmetic is local without PHP or upstream execution", async () => {
  expect((await results("100+24/12"))[0]?.value).toBe("102");
  await expect(results("1/0")).rejects.toThrow();
});
test("finds configured original workflow and passes query safely through stdin", async () => {
  expect(enginePath()).toBe(root);
  expect((await results("100 km in miles"))[0]).toMatchObject({ value: "62.137", single: "0.62137" });
});
test("blank and oversized queries have explicit behavior", async () => {
  expect(await results("")).toEqual([]);
  await expect(results("x".repeat(501))).rejects.toThrow("too long");
});

test("typing updates results without replacing or refocusing the search field", () => {
  const { create } = require("../src/state.ts");
  const { execFileSync } = require("node:child_process");
  const s = create("20");
  for (const query of ["20", "200", "200+5"]) {
    const action = JSON.parse(
      execFileSync(process.execPath, [join(import.meta.dir, "../src/main.ts"), "query", s.id, query], {
        encoding: "utf8",
        env: process.env,
      }),
    );
    expect(action.update.ids).not.toHaveProperty("root");
    expect(action.update.ids).not.toHaveProperty("query");
    expect(action.update.ids.items.data.src[0]["rowTitle.text"]).toBe(query === "200+5" ? "205" : query);
  }
});
