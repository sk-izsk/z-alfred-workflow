import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { infoPlist } from "./plist.ts";
const root = join(import.meta.dir, "..", "workflow");
writeFileSync(join(root, "info.plist"), JSON.stringify(infoPlist));
execFileSync("/usr/bin/plutil", ["-convert", "xml1", join(root, "info.plist")]);
for (const name of ["icon", "KEYWORD"])
  copyFileSync(join(root, "../assets/icon.png"), join(root, `${name}.png`));
// Result icons for the `cam` list.
mkdirSync(join(root, "icons"), { recursive: true });
for (const file of readdirSync(join(root, "../assets/icons")))
  copyFileSync(join(root, "../assets/icons", file), join(root, "icons", file));
console.log("Generated Camera metadata and icons");
