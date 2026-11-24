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

test("README markdown renders headings, images, links, lists and code", async () => {
  const { markdownToHtml } = await import("../src/markdown.ts");
  const html = markdownToHtml(
    '# Title\n\nSome **bold** `x<y` [link](https://a.b)\n\n![shot](https://i.png)\n\n- one\n- two\n\n```js\nif (a < b) {}\n```\n<p align="center">\n  <em>a</em> - b\n</p>',
  );
  expect(html).toContain("<h1>Title</h1>");
  expect(html).toContain('<strong>bold</strong> <code>x&lt;y</code> <a href="https://a.b">link</a>');
  expect(html).toContain('<img alt="shot" src="https://i.png">');
  expect(html).toContain("<ul>\n<li>one</li>\n<li>two</li>\n</ul>");
  expect(html).toContain("<pre><code>if (a &lt; b) {}</code></pre>");
  expect(html).toContain('<p align="center">\n  <em>a</em> - b\n</p>');
});
