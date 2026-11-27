import { expect, test } from "bun:test";
import { getSetting, removeSetting, setSetting } from "../src/jsonc.ts";

const settings = `{
  // my theme
  "workbench.colorTheme": "Old", /* keep */
  "[python]": { "workbench.colorTheme": "Nested" },
  "sync": { "blob": "{\\"workbench.colorTheme\\": \\"Fake\\"}" },
  "editor.fontSize": 14,
}`;

test("reads and replaces only the top-level setting", () => {
  expect(getSetting(settings, "workbench.colorTheme")).toBe("Old");
  const next = setSetting(settings, "workbench.colorTheme", 'New "One"');
  expect(getSetting(next, "workbench.colorTheme")).toBe('New "One"');
  expect(next).toContain('"[python]": { "workbench.colorTheme": "Nested" }');
  expect(next).toContain("// my theme");
  expect(next.replace('"New \\"One\\""', '"Old"')).toBe(settings);
});

test("adds the setting when missing", () => {
  expect(getSetting(setSetting("{}", "k", "v"), "k")).toBe("v");
  expect(getSetting(setSetting('{ "a": 1 }', "k", "v"), "a" as string)).toBeUndefined();
  expect(setSetting('{ "a": 1 }', "k", "v")).toBe('{\n  "k": "v", "a": 1 }');
  expect(getSetting(setSetting('{ "x": {"k": "no"} }', "k", "v"), "k")).toBe("v");
});

test("removes a setting cleanly (restoring 'no theme set')", () => {
  const text = '{\n  "a": 1,\n  "workbench.colorTheme": "X",\n  "b": 2\n}';
  const removed = removeSetting(text, "workbench.colorTheme");
  expect(getSetting(removed, "workbench.colorTheme")).toBeUndefined();
  expect(JSON.parse(removed)).toEqual({ a: 1, b: 2 });
  expect(
    JSON.parse(removeSetting('{ "a": 1, "workbench.colorTheme": "X" }', "workbench.colorTheme")),
  ).toEqual({ a: 1 });
  expect(removeSetting(setSetting(text, "workbench.colorTheme", "Y"), "workbench.colorTheme")).toBe(removed);
});

test("README for the native view: HTML images become Markdown, images are made local or dropped", async () => {
  const preview = await import("../src/preview.ts");
  const { mkdtempSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { pathToFileURL } = await import("node:url");
  const dir = mkdtempSync(join(tmpdir(), "ext with space-"));
  writeFileSync(join(dir, "shot.png"), "png");
  preview.setFetcher(async (url) =>
    url.includes("badge")
      ? new Response("<svg/>", { headers: { "content-type": "image/svg+xml" } })
      : url.includes("page")
        ? new Response("<html>", { headers: { "content-type": "text/html" } })
        : new Response("", { status: 404 }),
  );
  const md = await preview.nativeReadme(
    '# T\n\n<p align="center"><img src="shot.png" alt="Shot"></p>\n\n![b](https://x.dev/badge.svg) ![g](https://x.dev/gone.png) ![h](https://x.dev/page)\n\nText<br>more',
    pathToFileURL(`${dir}/`).href,
  );
  const paths = [...md.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((m) => m[1]!);
  expect(paths).toHaveLength(2); // the local screenshot and the badge; the 404 and the HTML page are dropped
  for (const p of paths) {
    expect(p.startsWith(preview.imageDir())).toBe(true);
    expect(p).not.toContain(" "); // Alfred's markdown view can't load paths with spaces
  }
  expect(md).toContain("![Shot]");
  expect(md).not.toContain("<p");
  expect(md).toContain("Text\nmore");
  // A badge wrapped in a link keeps only the image; a link around a dropped image disappears.
  const badges = await preview.nativeReadme(
    "[![b](https://x.dev/badge.svg)](https://x.dev) [![g](https://x.dev/gone.png)](https://x.dev) end",
  );
  expect(badges).toMatch(/^!\[b\]\(\/\S+\.svg\) {2}end$/);
  const full = await preview.previewMarkdown({
    name: "Ext",
    publisher: "pub",
    version: "1.0.0",
    installs: "2K",
    description: "Does things",
    readme: "",
  });
  expect(full.markdown).toContain("# Ext\n\npub · v1.0.0 · 2K installs\n\nDoes things");
  expect(full.markdown).toContain("_No README._");
  expect(full.icon).toBeUndefined();
});
