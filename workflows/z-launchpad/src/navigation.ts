import { launcherNavigation } from "../../../shared/launcher.ts";

// Launchpad has no launcher of its own: Back from the grid returns to Alfred's search.
export const { backVariables, performBack } = launcherNavigation("swiss");
