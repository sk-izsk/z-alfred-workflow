import { expect, test } from "bun:test";
import { appId, appName, categoryName } from "../src/apps.ts";
import { defaultLayout, fromLegacy, paginate, reconcile, validLayout } from "../src/layout.ts";
import { renderPage } from "../src/page.ts";

const A = (n: string) => `/Applications/${n}.app`;

test("the original's saved order imports with its page breaks and groups", () => {
  const items = [
    { id: "x", name: "Mail", paths: [A("Mail")] },
    {},
    { id: "g", name: "Work", paths: [A("Slack"), A("Zoom")] },
    { id: "y", name: "Notes", paths: [A("Notes")] },
  ];
  const layout = fromLegacy(items, 2);
  expect(layout.pages).toEqual([[A("Mail")], ["folder:f1", A("Notes")]]);
  expect(layout.folders.f1).toEqual({ name: "Work", apps: [A("Slack"), A("Zoom")] });
  expect(paginate([A("a"), null, A("b")], 2)).toEqual([[A("a")], [A("b")]]);
});

test("default order puts Apple's apps first, then the rest by name", () => {
  const installed = [
    A("Zed"),
    "/System/Applications/Mail.app",
    A("Arc"),
    "/System/Applications/App Store.app",
  ];
  expect(defaultLayout(installed, 3).pages).toEqual([
    ["/System/Applications/App Store.app", "/System/Applications/Mail.app", A("Arc")],
    [A("Zed")],
  ]);
});

test("reconcile drops removed apps, dissolves one-app folders, adds new apps and keeps page breaks", () => {
  const layout = {
    pages: [
      [A("Mail"), "folder:f1"],
      [A("Gone"), A("Notes")],
    ],
    folders: { f1: { name: "Work", apps: [A("Slack"), A("Removed")] } },
  };
  const next = reconcile(layout, [A("Mail"), A("Slack"), A("Notes"), A("New")], 2);
  expect(next.folders).toEqual({});
  expect(next.pages).toEqual([
    [A("Mail"), A("Slack")],
    [A("Notes"), A("New")],
  ]);
  // Overflowing pages flow forward instead of losing apps.
  const over = reconcile({ pages: [[A("a"), A("b"), A("c")]], folders: {} }, [A("a"), A("b"), A("c")], 2);
  expect(over.pages).toEqual([[A("a"), A("b")], [A("c")]]);
});

test("a layout from the page is refused when it duplicates, invents or orphans apps", () => {
  const known = new Set([A("a"), A("b"), A("c")]);
  const ok = { pages: [[A("a"), "folder:f1"]], folders: { f1: { name: " Tools ", apps: [A("b"), A("c")] } } };
  expect(validLayout(ok, known, 35)).toEqual({
    pages: [[A("a"), "folder:f1"]],
    folders: { f1: { name: "Tools", apps: [A("b"), A("c")] } },
  });
  expect(() => validLayout({ pages: [[A("a"), A("a")]], folders: {} }, known, 35)).toThrow();
  expect(() => validLayout({ pages: [[A("x")]], folders: {} }, known, 35)).toThrow();
  expect(() =>
    validLayout({ pages: [[A("a")]], folders: { f1: { name: "Lost", apps: [A("b"), A("c")] } } }, known, 35),
  ).toThrow();
  expect(() => validLayout({ pages: [[A("a"), A("b")]], folders: {} }, known, 1)).toThrow();
});

test("names, ids and categories; page data can't break out of its script tag", () => {
  expect(appName(A("Visual Studio Code"))).toBe("Visual Studio Code");
  expect(appId(A("Mail"))).toMatch(/^a[0-9a-f]{10}$/);
  expect(categoryName("public.app-category.developer-tools")).toBe("Developer Tools");
  const html = renderPage({
    apps: { a1: { name: "</script><b>x", icon: "icons/a1.png", cat: "" } },
    pages: [["a1"]],
    folders: {},
    cols: 7,
    rows: 5,
    page: 0,
    sel: "",
  });
  expect(html).not.toContain("</script><b>");
  expect(html).toContain("\\u003c/script>");
});
