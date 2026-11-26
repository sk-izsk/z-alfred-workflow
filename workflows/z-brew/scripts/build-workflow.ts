import { profileWindow, profileInfo } from "../../../shared/ui-profile.ts";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { packages } from "../ui/views.ts";
import { infoPlist } from "./plist.ts";

const root = join(import.meta.dir, "..", "workflow");
for (const [name, ui] of Object.entries(packages)) {
  mkdirSync(join(root, name), { recursive: true });
  writeFileSync(join(root, name, "ui.json"), `${JSON.stringify(profileWindow(ui, "brw"), null, 2)}\n`);
}
const plist = join(root, "info.plist");
writeFileSync(plist, JSON.stringify(profileInfo(infoPlist)));
execFileSync("/usr/bin/plutil", ["-convert", "xml1", plist]);
const icon = join(root, "..", "assets", "icon.png");
for (const name of [
  "icon",
  "ROOT",
  ...Object.keys(packages).map((viewName) => viewName.replace(".alfredui", "").toUpperCase() + "KW"),
])
  copyFileSync(icon, join(root, `${name}.png`));
console.log("workflow: 9 native windows, info.plist and Raycast Brew icon");
