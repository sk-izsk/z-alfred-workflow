import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { profileInfo, profileWindow } from "../../../shared/ui-profile.ts";
import { DEFAULT_MAP_HEIGHT, DEFAULT_WIDTH, mapWidth, mapWindow } from "../ui/window.ts";
import { infoPlist } from "./plist.ts";

const root = join(import.meta.dir, "..", "workflow");
mkdirSync(join(root, "maps.alfredui"), { recursive: true });

// The shared profile clamps windows to 780 pt; a map needs the brief's 1180 (configurable, screen-clamped).
const ui = profileWindow(mapWindow, "zmap") as any;
ui.window.size.width = DEFAULT_WIDTH;
for (const event of ui.window.root.events)
  if (event.triggers === "preload") event.action.src.window.resize.width = DEFAULT_WIDTH;
const map = ui.window.root.components[1].components[0];
if (map.id !== "map") throw new Error("map view moved; update build-workflow.ts");
map.constraints.size = { width: mapWidth(DEFAULT_WIDTH), height: DEFAULT_MAP_HEIGHT };

writeFileSync(join(root, "maps.alfredui/ui.json"), JSON.stringify(ui, null, 2) + "\n");
writeFileSync(join(root, "info.plist"), JSON.stringify(profileInfo(infoPlist)));
execFileSync("/usr/bin/plutil", ["-convert", "xml1", join(root, "info.plist")]);
for (const name of ["icon", "KEYWORD", "TRIGGER", "UI"])
  copyFileSync(join(root, "../assets/icon.png"), join(root, `${name}.png`));
console.log("Generated Maps UI, metadata and icons");
