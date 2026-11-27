import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { profileInfo, profileWindow } from "../../../shared/ui-profile.ts";
import { notionWindow } from "../ui/window.ts";
import { infoPlist } from "./plist.ts";

const root = join(import.meta.dir, "..", "workflow");
mkdirSync(join(root, "notion.alfredui"), { recursive: true });
writeFileSync(
  join(root, "notion.alfredui/ui.json"),
  JSON.stringify(profileWindow(notionWindow, "nt"), null, 2) + "\n",
);
writeFileSync(join(root, "info.plist"), JSON.stringify(profileInfo(infoPlist)));
execFileSync("/usr/bin/plutil", ["-convert", "xml1", join(root, "info.plist")]);
for (const name of ["icon", "SEARCH", "CREATE", "CAPTURE", "NOTE", "TEXT", "UI"])
  copyFileSync(join(root, "../assets/icon.png"), join(root, `${name}.png`));
console.log("Generated Notion UI, metadata and icons");
