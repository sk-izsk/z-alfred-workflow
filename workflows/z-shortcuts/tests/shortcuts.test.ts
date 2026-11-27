import { expect, test } from "bun:test";
import { ignoredFolders, inFolder, matches, parseList, type Shortcut } from "../src/shortcuts.ts";

const item = (name: string, folder = "", acceptsInput?: boolean): Shortcut => ({
  id: name.toUpperCase(),
  name,
  folder,
  acceptsInput,
});

test("parses `shortcuts list --show-identifiers`, including names with brackets", () => {
  const text = [
    "Resize Image (2F1A9C4E-1B2C-4D3E-8F90-0A1B2C3D4E5F)",
    "Note (draft) (A1B2C3D4-E5F6-4789-9ABC-DEF012345678)",
    "",
    "not a shortcut line",
  ].join("\n");
  expect(parseList(text)).toEqual([
    { name: "Resize Image", id: "2F1A9C4E-1B2C-4D3E-8F90-0A1B2C3D4E5F" },
    { name: "Note (draft)", id: "A1B2C3D4-E5F6-4789-9ABC-DEF012345678" },
  ]);
});

test("search matches every word in the name or folder; folders filter", () => {
  const a = item("Resize Image", "Photos"),
    b = item("Morning Routine");
  expect(matches(a, "image photo")).toBe(true);
  expect(matches(a, "resize video")).toBe(false);
  expect(matches(b, "no folder")).toBe(true);
  expect(inFolder(a, "all") && inFolder(a, "Photos") && !inFolder(a, "none")).toBe(true);
  expect(inFolder(b, "none")).toBe(true);
});

test("hidden folders come one per line from Configuration", () => {
  expect([...ignoredFolders(" Starter Shortcuts \n\nNo Folder\n")]).toEqual([
    "Starter Shortcuts",
    "No Folder",
  ]);
});
