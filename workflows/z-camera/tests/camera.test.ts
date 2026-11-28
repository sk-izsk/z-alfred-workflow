import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { infoPlist } from "../scripts/plist.ts";

const bin = (name: string) => fileURLToPath(new URL(`../workflow/bin/${name}`, import.meta.url));
const preview = readFileSync(bin("preview.js"), "utf8");
const toggle = readFileSync(bin("camera"), "utf8");

test("the preview app compiles, never redeclares JXA globals, and never records", () => {
  execFileSync("/usr/bin/osacompile", [
    "-l",
    "JavaScript",
    "-o",
    join(tmpdir(), "izsk-preview-test.scpt"),
    bin("preview.js"),
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
    expect(preview).not.toMatch(new RegExp(`(?:const|let|var|function)\\s+${name}\\b`));
  // Mirroring follows the settings; photos, not movies or sound.
  expect(preview).toContain("connection.videoMirrored = on");
  expect(preview).toContain("options.mirrorPhotos");
  expect(preview).not.toMatch(/AVCaptureMovieFileOutput|AVCaptureAudio/);
  // Menu items have no key equivalents: in an open menu they would beat the highlighted item.
  expect(preview).toContain('initWithTitleActionKeyEquivalent(title, action, "")');
  // Setting a CALayer colour (CGColor) from JXA crashes the app: colours go through NSBox.
  expect(preview).not.toMatch(/\.CGColor\b/);
});

test("the toggle script is valid zsh, builds on this Mac and never deletes anything", () => {
  execFileSync("/bin/zsh", ["-n", bin("camera")]);
  expect(toggle).toContain("/usr/bin/osacompile -l JavaScript -s");
  expect(toggle).toContain("NSCameraUsageDescription");
  expect(toggle).not.toMatch(/\brm\b/);
});

test("keyword, hotkey and Swiss's External Trigger all run the toggle", () => {
  const into = Object.entries(infoPlist.connections)
    .filter(([, links]) => links.some((l) => l.destinationuid === "RUN"))
    .map(([from]) => from)
    .toSorted();
  expect(into).toEqual(["HOTKEY", "KEYWORD", "TRIGGER"]);
  const trigger = infoPlist.objects.find((o) => o.uid === "TRIGGER")!.config as { triggerid: string };
  expect(trigger.triggerid).toBe("open");
});
