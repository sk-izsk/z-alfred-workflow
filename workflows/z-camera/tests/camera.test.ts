import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { infoPlist } from "../scripts/plist.ts";

const SCRIPT = fileURLToPath(new URL("../workflow/bin/camera.js", import.meta.url));
const source = readFileSync(SCRIPT, "utf8");
/** The objects connected into `uid`. */
const into = (uid: string) =>
  Object.entries(infoPlist.connections)
    .filter(([, links]) => links.some((l) => l.destinationuid === uid))
    .map(([from]) => from)
    .toSorted();

test("the QuickTime script compiles and never redeclares JXA globals", () => {
  execFileSync("/usr/bin/osacompile", [
    "-l",
    "JavaScript",
    "-o",
    join(tmpdir(), "izsk-camera-test.scpt"),
    SCRIPT,
  ]);
  for (const name of [
    "\\$",
    "Path",
    "delay",
    "Application",
    "Library",
    "ObjC",
    "Ref",
    "Progress",
    "Automation",
  ])
    expect(source).not.toMatch(new RegExp(`(?:const|let|var|function)\\s+${name}\\b`));
  // CGWindowList is a CFArray: deepUnwrap alone doesn't make it a JS array.
  expect(source).toContain("ObjC.deepUnwrap(ObjC.castRefToObject($.CGWindowListCopyWindowInfo");
});

test("the preview is muted and never recorded; photos capture only the image area", () => {
  expect(source).toContain("doc.muted = true");
  expect(source).not.toMatch(/\.start\(|\.save\(/);
  expect(source).toContain('close({ saving: "no" })');
  expect(source).toContain("screencapture -x -R");
});

test("every list item has its icon, and every route reaches the one script", () => {
  for (const icon of [...source.matchAll(/item\([^)]*"(\w+)"(?:, \w+)?\)/g)].map((m) => m[1]))
    expect(existsSync(new URL(`../assets/icons/${icon}.png`, import.meta.url))).toBe(true);
  expect(into("RUN")).toEqual(["KEYWORD", "PHOTO", "TOGGLE"]);
  expect(into("TOGGLE")).toEqual(["PREVIEW_HOTKEY", "TRIGGER"]);
  expect(into("PHOTO")).toEqual(["PHOTO_HOTKEY"]);
  const trigger = infoPlist.objects.find((o) => o.uid === "TRIGGER")!.config as { triggerid: string };
  expect(trigger.triggerid).toBe("open");
});
