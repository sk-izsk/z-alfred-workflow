import { profileCommand } from "../../../shared/ui-profile.ts";
await profileCommand(() => import("./env.ts"));
import * as clone from "./commands/clone.ts";
import { chrome } from "./commands/common.ts";
import { cloneFilter } from "./commands/clonefilter.ts";
import { fileAction } from "./commands/fileactions.ts";
import * as ext from "./commands/extensions.ts";
import * as gallery from "./commands/gallery.ts";
import { post } from "./commands/post.ts";
import * as projects from "./commands/projects.ts";
import * as root from "./commands/root.ts";
import * as themes from "./commands/themes.ts";
import { openPath } from "./launch.ts";
import { type Action, errorStatus, print } from "./ui.ts";

type Command = (args: string[]) => Promise<Action>;

/** Commands called from Alfred UI windows: they print a JSON action. */
const ui: Record<string, Command> = {
  "projects-init": projects.projectsInit,
  "projects-picker": projects.projectsPicker,
  "projects-filter": projects.projectsFilter,
  "projects-refresh": projects.projectsRefresh,
  "ext-pickers": ext.extPickers,
  "ext-filter": ext.extFilter,
  "gallery-pickers": gallery.galleryPickers,
  "gallery-quit": gallery.galleryQuit,
  "theme-init": themes.themeInit,
  "theme-pickers": themes.themePickers,
  "theme-filter": themes.themeFilter,
  "theme-restore": themes.themeRestore,
  theme: themes.theme,
  project: projects.project,
  "ext-init": ext.extInit,
  ext: ext.ext,
  "gallery-init": gallery.galleryInit,
  "gallery-search": gallery.gallerySearch,
  gallery: gallery.gallery,
  "clone-init": clone.cloneInit,
  "clone-preview": clone.clonePreview,
  "clone-run": clone.cloneRun,
  chrome,
};

/** Commands called from Script Filters / Run Scripts: they print plain text or Alfred JSON. */
const scripts: Record<string, (args: string[]) => Promise<void>> = {
  root: root.root,
  "root-action": root.rootAction,
  "clone-filter": cloneFilter,
  "file-action": fileAction,
  post,
  // File Filter / File Action: one path, or several separated by tabs.
  open: async ([paths = ""]) => {
    for (const path of paths.split("\t").filter(Boolean)) await openPath(path);
  },
};

const [command = "", ...args] = process.argv.slice(2);

if (command in ui) {
  print(await ui[command]!(args).catch(errorStatus));
} else if (command in scripts) {
  await scripts[command]!(args).catch((error: unknown) =>
    process.stdout.write(error instanceof Error ? error.message : String(error)),
  );
} else {
  process.stdout.write(`Unknown command: ${command}`);
}
// Icon downloads may still be running; Alfred waits for exit, so don't let them hold the window.
process.exit(0);
