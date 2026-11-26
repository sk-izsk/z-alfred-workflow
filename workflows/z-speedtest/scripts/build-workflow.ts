import { profileWindow, profileInfo } from "../../../shared/ui-profile.ts";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { speedtestWindow } from "../ui/window.ts";
import { infoPlist } from "./plist.ts";
const root = join(import.meta.dir, "..", "workflow");
mkdirSync(join(root, "speedtest.alfredui"), { recursive: true });
writeFileSync(
  join(root, "speedtest.alfredui", "ui.json"),
  `${JSON.stringify(profileWindow(speedtestWindow, "spt"), null, 2)}\n`,
);
const plist = join(root, "info.plist");
writeFileSync(plist, JSON.stringify(profileInfo(infoPlist)));
execFileSync("/usr/bin/plutil", ["-convert", "xml1", plist]);
for (const name of ["icon", "KEYWORD", "UI"])
  copyFileSync(join(root, "..", "assets", "icon.png"), join(root, `${name}.png`));
console.log("Generated Speed Test UI and info.plist");
