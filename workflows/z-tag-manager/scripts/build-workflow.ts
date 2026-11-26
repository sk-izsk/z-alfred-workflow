import { profileWindow, profileInfo } from "../../../shared/ui-profile.ts";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { toolWindow } from "../ui/window.ts";
import { infoPlist } from "./plist.ts";
const root = join(import.meta.dir, "..", "workflow");
mkdirSync(join(root, "tags.alfredui"), { recursive: true });
writeFileSync(
  join(root, "tags.alfredui/ui.json"),
  JSON.stringify(profileWindow(toolWindow, "tags"), null, 2) + "\n",
);
writeFileSync(join(root, "info.plist"), JSON.stringify(profileInfo(infoPlist)));
execFileSync("/usr/bin/plutil", ["-convert", "xml1", join(root, "info.plist")]);
for (const name of ["icon", "KEYWORD", "UI"])
  copyFileSync(join(root, "../assets/icon.png"), join(root, `${name}.png`));
console.log("Generated native Tag Manager UI, metadata and icons");
