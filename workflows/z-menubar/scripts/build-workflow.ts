import { execFileSync } from "node:child_process";
import { copyFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { infoPlist } from "./plist.ts";
const root = join(import.meta.dir, "..", "workflow");
writeFileSync(join(root, "info.plist"), JSON.stringify(infoPlist));
execFileSync("/usr/bin/plutil", ["-convert", "xml1", join(root, "info.plist")]);
for (const name of ["icon", "KEYWORD"])
  copyFileSync(join(root, "../assets/icon.png"), join(root, `${name}.png`));
console.log("Generated Menu Bar metadata and icons");
