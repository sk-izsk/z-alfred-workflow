import { launchInput } from "./navigation.ts";
import type { Scope } from "../../../shared/window-access.ts";
export const windowInput = (raw = ""): { query: string; returnTo: string; scope: Scope } => {
  const value = launchInput(raw);
  if (!value.returnTo && value.query.startsWith("desktop:"))
    return { ...value, query: value.query.slice(8), scope: "desktop" };
  return { ...value, scope: "all" };
};
