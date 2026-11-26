import { profileWindow, profileInfo } from "../../../shared/ui-profile.ts";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { packages } from "../ui/index.ts";
import { infoPlist } from "./plist.ts";

const root = join(import.meta.dir, "..", "workflow");
for (const [name, ui] of Object.entries(packages)) {
  mkdirSync(join(root, name), { recursive: true });
  writeFileSync(join(root, name, "ui.json"), `${JSON.stringify(profileWindow(ui, "cald"), null, 2)}\n`);
}
const plist = join(root, "info.plist");
writeFileSync(plist, JSON.stringify(profileInfo(infoPlist)));
execFileSync("/usr/bin/plutil", ["-convert", "xml1", plist]);
const icon = join(root, "..", "assets", "icons", "calendar.png");
mkdirSync(join(root, "icons"), { recursive: true });
for (const file of readdirSync(join(root, "..", "assets", "icons")))
  copyFileSync(join(root, "..", "assets", "icons", file), join(root, "icons", file));
for (const name of ["icon", "ROOT", "AGENDAKW", "QUICKKW", "CREATEKW"])
  copyFileSync(icon, join(root, `${name}.png`));
copyFileSync(join(import.meta.dir, "eventkit.js"), join(root, "bin", "eventkit.js"));
console.log("workflow: 3 windows, info.plist, Raycast Calendar icon and EventKit bridge");
