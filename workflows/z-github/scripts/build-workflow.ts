import { profileWindow, profileInfo } from "../../../shared/ui-profile.ts";
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { githubWindow } from "../ui/window.ts";
import { infoPlist } from "./plist.ts";
const root = join(import.meta.dir, "..", "workflow");
mkdirSync(join(root, "github.alfredui"), { recursive: true });
writeFileSync(
  join(root, "github.alfredui", "ui.json"),
  JSON.stringify(profileWindow(githubWindow, "gith"), null, 2) + "\n",
);
writeFileSync(join(root, "info.plist"), JSON.stringify(profileInfo(infoPlist)));
execFileSync("/usr/bin/plutil", ["-convert", "xml1", join(root, "info.plist")]);
cpSync(join(root, "..", "assets"), join(root, "assets"), { recursive: true });
for (const name of ["icon", "MENU", "MYPRS", "UI", "HOTKEY"])
  copyFileSync(join(root, "assets", "github", "icon.png"), join(root, name + ".png"));
copyFileSync(join(root, "assets", "git-repos", "git-repos-icon.png"), join(root, "LOCAL.png"));
console.log("Generated GitHub workflow, native UI and source icons");

// Raycast tints these monochrome source glyphs; Alfred file images need the fill embedded.
for (const file of readdirSync(join(root, "assets", "github"))) {
  if (!file.endsWith(".svg")) continue;
  const colour = file.includes("merged")
    ? "#a371f7"
    : file.includes("closed")
      ? "#f85149"
      : file.includes("draft")
        ? "#9ca3af"
        : file.includes("open")
          ? "#3fb950"
          : "#a1a1aa";
  const path = join(root, "assets", "github", file);
  writeFileSync(path, readFileSync(path, "utf8").replace("<svg ", `<svg fill="${colour}" `));
}
