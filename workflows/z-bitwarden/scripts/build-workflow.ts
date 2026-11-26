import { profileWindow, profileInfo } from "../../../shared/ui-profile.ts";
/** Writes every `<name>.alfredui/ui.json` and `info.plist` into workflow/. */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { packages } from "../ui/views.ts";
import { infoPlist } from "./plist.ts";

const root = join(import.meta.dir, "..", "workflow");

for (const [name, ui] of Object.entries(packages)) {
  mkdirSync(join(root, name), { recursive: true });
  writeFileSync(join(root, name, "ui.json"), `${JSON.stringify(profileWindow(ui, "bwa"), null, 2)}\n`);
}

const plist = join(root, "info.plist");
writeFileSync(plist, JSON.stringify(profileInfo(infoPlist)));
execFileSync("/usr/bin/plutil", ["-convert", "xml1", plist]);

/** Object icons: Alfred shows `<object uid>.png` for each keyword. */
const icons: Record<string, string> = {
  SEARCHKW: "search",
  ROOT: "search",
  SEARCHHK: "search",
  GENKW: "generate-password",
  QUICKKW: "generate-password-quick",
  AUTHKW: "authenticator",
  SENDSKW: "search-sends",
  NEWKW: "create-login",
  FOLDERKW: "create-folder",
  SYNCKW: "search",
  LOCKKW: "lock-vault",
  LOGOUTKW: "logout-vault",
};
for (const [uid, icon] of Object.entries(icons)) {
  copyFileSync(join(root, "..", "assets", "icons", `${icon}.png`), join(root, `${uid}.png`));
}

console.log(
  `workflow: ${Object.keys(packages).length} windows, info.plist, ${Object.keys(icons).length} icons`,
);
