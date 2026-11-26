import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  normalize,
  validURL,
  bounded,
  preferences,
  savePreferences,
  remember,
  search,
} from "../src/gifs.ts";
import { create, read, save } from "../src/state.ts";
import { components } from "../ui/window.ts";
import { launchInput } from "../src/navigation.ts";
const root = mkdtempSync(join(tmpdir(), "gif-tests-"));
const before = { ...process.env };
process.env.alfred_workflow_cache = join(root, "cache");
process.env.alfred_workflow_data = join(root, "data");
afterAll(() => {
  process.env = before;
  rmSync(root, { recursive: true, force: true });
});
const raw = {
  data: [
    {
      id: "abc",
      title: "Hello",
      url: "https://giphy.com/gifs/abc",
      images: {
        original: { url: "https://media.giphy.com/media/abc/giphy.gif" },
        fixed_width: { url: "https://media.giphy.com/media/abc/200w.gif" },
      },
    },
  ],
};
test("provider mapping only accepts trusted HTTPS media", () => {
  const rows = normalize(raw, "giphy");
  expect(rows).toHaveLength(1);
  expect(rows[0]!.id).toBe("giphy:abc");
  expect(validURL("https://giphy.com.evil.test/x.gif")).toBe("");
  expect(validURL("http://giphy.com/x.gif")).toBe("");
  expect(validURL("https://a:b@giphy.com/x.gif")).toBe("");
  expect(
    normalize(
      { data: [{ ...raw.data[0], images: { original: { url: "file:///etc/passwd" } } }] },
      "giphy",
    ),
  ).toHaveLength(0);
});
test("favorites, recents and layout persist without losing one another", () => {
  const e = normalize(raw, "giphy")[0]!;
  const p = preferences();
  p.layout = "list";
  savePreferences(p);
  remember(e, true);
  remember(e);
  remember(e);
  expect(preferences().favorites).toHaveLength(1);
  expect(preferences().recent).toHaveLength(1);
  expect(preferences().layout).toBe("list");
  remember(e, true);
  expect(preferences().favorites).toHaveLength(0);
});
test("list/grid keep provider controls beside each other and session state intact", () => {
  const s = create("hello", "");
  s.rows = normalize(raw, "giphy");
  s.selected = s.rows[0]!.id;
  save(s);
  expect(components(s, "grid")[1]!.components[0].cols).toBe(4);
  expect(components(s, "list")[1]!.components[0].cols).toBe(1);
  expect(components(s, "grid")[0]!.components[1].components.map((x: any) => x.id)).toEqual([
    "source",
    "layoutPicker",
  ]);
  expect(read(s.id)).toEqual(s);
  expect(
    launchInput(
      "swiss:v1:" +
        Buffer.from(JSON.stringify({ query: "hello", returnTo: s.id })).toString("base64url"),
    ).returnTo,
  ).toBe(s.id);
});
test("response size is bounded even without content length; direct API requires own key", async () => {
  await expect(bounded(new Response("123456"), 5)).rejects.toThrow("too large");
  await expect(search("test", "direct", 0, true)).rejects.toThrow("API key");
});
