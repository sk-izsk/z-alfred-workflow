import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  canEject,
  describe,
  dissenter,
  kindOf,
  matches,
  parseImages,
  size,
  sortDrives,
  type Drive,
  type Volume,
} from "../src/drives.ts";

const volume = (name: string, extra: Partial<Volume> = {}): Volume => ({
  path: `/Volumes/${name}`,
  name,
  total: 1_000_000_000_000,
  free: 967_000_000_000,
  ejectable: false,
  removable: false,
  internal: false,
  local: true,
  root: false,
  readOnly: false,
  format: "APFS",
  ...extra,
});
const drive = (v: Volume, image?: string): Drive => ({ ...v, image, kind: kindOf(v, image) });

test("kinds, order and what can be ejected", () => {
  const root = drive(volume("Macintosh HD", { root: true, internal: true, path: "/" }));
  const ssd = drive(volume("Backup SSD"));
  const dmg = drive(
    volume("Installer", { ejectable: true, total: 50_000_000, free: 4_800_000 }),
    "/Users/demo/Downloads/Installer.dmg",
  );
  const share = drive(volume("Team Share", { local: false, format: "SMB" }));
  expect([root.kind, ssd.kind, dmg.kind, share.kind]).toEqual(["startup", "external", "image", "network"]);
  expect(sortDrives([share, dmg, ssd, root]).map((d) => d.name)).toEqual([
    "Macintosh HD",
    "Backup SSD",
    "Installer",
    "Team Share",
  ]);
  expect([root, ssd, dmg, share].map(canEject)).toEqual([false, true, true, true]);
  expect(describe(ssd)).toBe("External · APFS · 967 GB free of 1.0 TB");
  expect(describe(dmg)).toBe("Disk Image · APFS · 4.8 MB free of 50.0 MB · Installer.dmg");
  expect(matches(dmg, "installer dmg")).toBe(true);
  expect(matches(dmg, "network")).toBe(false);
});

test("sizes use decimal units like Finder", () => {
  expect([size(0), size(999), size(4_800_000), size(245_107_195_904)]).toEqual([
    "0 KB",
    "999 bytes",
    "4.8 MB",
    "245 GB",
  ]);
});

test("opened disk images come from hdiutil, macOS's own images are left out", () => {
  const json = JSON.stringify({
    images: [
      {
        "image-path": "/Users/demo/Downloads/App.dmg",
        "system-entities": [{}, { "mount-point": "/Volumes/App" }],
      },
      {
        "image-path": "/Users/demo/Hidden.dmg",
        "system-entities": [{ "mount-point": "/private/tmp/hidden" }],
      },
      {
        "image-path": "/System/Library/AssetsV2/runtime.dmg",
        "system-entities": [{ "mount-point": "/Library/Developer/x" }],
      },
    ],
  });
  expect([...parseImages(json)]).toEqual([
    ["/Volumes/App", "/Users/demo/Downloads/App.dmg"],
    ["/private/tmp/hidden", "/Users/demo/Hidden.dmg"],
  ]);
});

test("names the app holding a drive from diskutil's refusal", () => {
  expect(
    dissenter("Unmount was dissented by PID 579 (/Applications/Preview.app/Contents/MacOS/Preview)"),
  ).toBe("Preview");
  expect(dissenter("Volume X on disk4s1 failed to unmount: dissented by PID 45 (/bin/sleep)")).toBe("sleep");
  expect(dissenter("Unmount failed for some other reason")).toBeUndefined();
});

test("the volume helper never redeclares JXA globals", () => {
  const source = readFileSync(new URL("../workflow/bin/volumes.js", import.meta.url), "utf8");
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
});
