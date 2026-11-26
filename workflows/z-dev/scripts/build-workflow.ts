import { profileWindow, profileInfo } from "../../../shared/ui-profile.ts";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { devWindow } from "../ui/window.ts";
import { infoPlist } from "./plist.ts";
const root = join(import.meta.dir, "..", "workflow");
mkdirSync(join(root, "dev.alfredui"), { recursive: true });
writeFileSync(
  join(root, "dev.alfredui/ui.json"),
  JSON.stringify(profileWindow(devWindow, "dev"), null, 2) + "\n",
);
writeFileSync(join(root, "info.plist"), JSON.stringify(profileInfo(infoPlist)));
execFileSync("/usr/bin/plutil", ["-convert", "xml1", join(root, "info.plist")]);
for (const name of ["icon", "KEYWORD", "UI"])
  copyFileSync(join(root, "../assets/icon.png"), join(root, `${name}.png`));
console.log("Generated native Dev UI, metadata and icons");

mkdirSync(join(root, "icons"), { recursive: true });
for (const file of readdirSync(join(root, "../assets/tools")))
  copyFileSync(join(root, "../assets/tools", file), join(root, "icons", file));
