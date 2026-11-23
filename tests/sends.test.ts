import { expect, test } from "bun:test";
import { downloadTarget, parseMaxViews } from "../src/commands/sends.ts";

test("max views: blank means unlimited, anything else must be a whole number of 1 or more", () => {
  expect(parseMaxViews("")).toBeNull();
  expect(parseMaxViews("   ")).toBeNull();
  expect(parseMaxViews("1")).toBe(1);
  expect(parseMaxViews(" 25 ")).toBe(25);
  for (const bad of ["one", "0", "-1", "2.5", "1e3", "3 views"])
    expect(() => parseMaxViews(bad)).toThrow(/whole number/);
});

const none = () => false;

test("a received file never leaves the download folder, and never replaces an existing file", () => {
  const dir = "/Users/me/Downloads";
  expect(downloadTarget(dir, "report.pdf", none)).toBe(`${dir}/report.pdf`);
  // a hostile file name cannot climb out of the folder
  expect(downloadTarget(dir, "../../.ssh/authorized_keys", none)).toBe(`${dir}/authorized_keys`);
  expect(downloadTarget(dir, "/etc/passwd", none)).toBe(`${dir}/passwd`);
  expect(downloadTarget(dir, "..\\..\\win.ini", none)).toBe(`${dir}/win.ini`);
  expect(downloadTarget(dir, "..", none)).toBe(`${dir}/send`);
  expect(downloadTarget(dir, "", none)).toBe(`${dir}/send`);
  // an existing file is kept: the new one gets a number before the extension
  const taken = new Set([`${dir}/report.pdf`, `${dir}/report (1).pdf`]);
  expect(downloadTarget(dir, "report.pdf", (p) => taken.has(p))).toBe(`${dir}/report (2).pdf`);
  expect(downloadTarget(dir, "notes", (p) => p === `${dir}/notes`)).toBe(`${dir}/notes (1)`);
});
