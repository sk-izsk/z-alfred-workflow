/** Every window, keyed by its package folder in workflow/. */
import { clone } from "./clone.ts";
import { extensions } from "./extensions.ts";
import { install } from "./install.ts";
import { projects } from "./projects.ts";
import { themes } from "./themes.ts";

export const packages = {
  "projects.alfredui": projects,
  "extensions.alfredui": extensions,
  "install.alfredui": install,
  "clone.alfredui": clone,
  "themes.alfredui": themes,
};
