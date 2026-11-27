// Navigation for tools opened from a launcher (Swiss or Dev), shared by every tool workflow.
// v1 protocol: a fixed launcher and a validated session ID; never accept a destination bundle from input.
import { execFileSync } from "node:child_process";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const LAUNCHERS = {
  swiss: { name: "Swiss", bundle: "com.izsk.swiss" },
  dev: { name: "Dev", bundle: "com.izsk.dev" },
} as const;

export const launcherNavigation = (launcher: keyof typeof LAUNCHERS) => {
  const { name, bundle } = LAUNCHERS[launcher];
  const prefix = `${launcher}:v1:`;
  const launchInput = (raw = ""): { query: string; returnTo: string } => {
    if (!raw.startsWith(prefix)) return { query: raw, returnTo: "" };
    try {
      if (raw.length > 2000) throw new Error();
      const value = JSON.parse(Buffer.from(raw.slice(prefix.length), "base64url").toString("utf8"));
      if (!uuid.test(value.returnTo) || typeof value.query !== "string" || value.query.length > 500)
        throw new Error();
      return { query: value.query, returnTo: value.returnTo };
    } catch {
      throw new Error(`Invalid ${name} launch. Reopen the tool from ${name}.`);
    }
  };
  const backVariables = (key: string, raw = ""): Record<string, string> => ({
    [key]: "back",
    [`${launcher}_return`]: launchInput(raw).returnTo,
  });
  /** Back from the first screen: return to the launcher that opened the tool, else Alfred's search. */
  const performBack = (token = ""): void => {
    const script = uuid.test(token)
      ? `on run argv\ntell application id "com.runningwithcrayons.Alfred" to run trigger "open" in workflow "${bundle}" with argument (item 1 of argv)\nend run`
      : 'tell application id "com.runningwithcrayons.Alfred" to search ""';
    execFileSync("/usr/bin/osascript", ["-e", script, ...(uuid.test(token) ? [`resume:${token}`] : [])], {
      timeout: 5000,
    });
  };
  return { launchInput, backVariables, performBack };
};
