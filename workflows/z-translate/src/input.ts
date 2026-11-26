import { execFileSync } from "node:child_process";
export const clipboard = (): string =>
  execFileSync("/usr/bin/pbpaste", [], { encoding: "utf8", maxBuffer: 1e6, timeout: 3000 });
/** Explicit launch text takes precedence; clipboard access happens once, only on request. */
export const launchText = (query: string, useClipboard: boolean, readClipboard = clipboard): string =>
  query.trim() || !useClipboard ? query : readClipboard();
