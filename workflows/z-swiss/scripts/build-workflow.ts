import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { swissWindow } from "../ui/window.ts";
import { infoPlist } from "./plist.ts";
const root = join(import.meta.dir, "..", "workflow");
mkdirSync(join(root, "swiss.alfredui"), { recursive: true });
writeFileSync(join(root, "swiss.alfredui/ui.json"), JSON.stringify(swissWindow, null, 2) + "\n");
writeFileSync(join(root, "info.plist"), JSON.stringify(infoPlist));
execFileSync("/usr/bin/plutil", ["-convert", "xml1", join(root, "info.plist")]);
for (const name of ["icon", "KEYWORD", "UI"])
  copyFileSync(join(root, "../assets/icon.png"), join(root, `${name}.png`));
console.log("Generated native Swiss UI, metadata and icons");

mkdirSync(join(root, "icons"), { recursive: true });
for (const file of readdirSync(join(root, "../assets/tools")))
  copyFileSync(join(root, "../assets/tools", file), join(root, "icons", file));
