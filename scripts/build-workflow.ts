/** Writes every `<name>.alfredui/ui.json`, info.plist and the icons into workflow/. */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { packages } from "../ui/index.ts";
import { infoPlist } from "./plist.ts";

const root = join(import.meta.dir, "..", "workflow");
const assets = join(import.meta.dir, "..", "assets", "icons");

for (const [name, ui] of Object.entries(packages)) {
  mkdirSync(join(root, name), { recursive: true });
  writeFileSync(join(root, name, "ui.json"), `${JSON.stringify(ui, null, 2)}\n`);
}

const plist = join(root, "info.plist");
writeFileSync(plist, JSON.stringify(infoPlist));
execFileSync("/usr/bin/plutil", ["-convert", "xml1", plist]);

// Menu item icons (the `vsc` Script Filter refers to icons/<name>.png).
mkdirSync(join(root, "icons"), { recursive: true });
for (const png of readdirSync(assets)) copyFileSync(join(assets, png), join(root, "icons", png));
copyFileSync(join(assets, "icon.png"), join(root, "icon.png"));

/** Object icons: Alfred shows `<object uid>.png` for each keyword in its results. */
const objectIcons: Record<string, string> = {
  ROOT: "icon",
  PROJECTSKW: "projects",
  PROJECTSHK: "projects",
  EXTENSIONSKW: "extensions",
  INSTALLKW: "install",
  CLONEFILTER: "clone",
  THEMESKW: "themes",
  FIND: "find",
  FILEACTION: "icon",
  NEWWINKW: "window",
};
for (const [uid, icon] of Object.entries(objectIcons)) {
  copyFileSync(join(assets, `${icon}.png`), join(root, `${uid}.png`));
}

console.log(`workflow: ${Object.keys(packages).length} windows, info.plist, icons`);
