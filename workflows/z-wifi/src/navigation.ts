import { execFileSync } from "node:child_process";
// Dev v1: a fixed launcher and a validated session ID; never accept a destination bundle from input.
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export const launchInput = (raw = ""): { query: string; returnTo: string } => {
  if (!raw.startsWith("dev:v1:")) return { query: raw, returnTo: "" };
  try {
    if (raw.length > 2000) throw new Error();
    const value = JSON.parse(Buffer.from(raw.slice(7), "base64url").toString("utf8"));
    if (!uuid.test(value.returnTo) || typeof value.query !== "string" || value.query.length > 500)
      throw new Error();
    return { query: value.query, returnTo: value.returnTo };
  } catch {
    throw new Error("Invalid Dev launch. Reopen the tool from Dev.");
  }
};
export const backVariables = (key: string, raw = ""): Record<string, string> => ({
  [key]: "back",
  dev_return: launchInput(raw).returnTo,
});
export const performBack = (token = ""): void => {
  const script = uuid.test(token)
    ? 'on run argv\ntell application id "com.runningwithcrayons.Alfred" to run trigger "open" in workflow "com.izsk.dev" with argument (item 1 of argv)\nend run'
    : 'tell application id "com.runningwithcrayons.Alfred" to search ""';
  execFileSync("/usr/bin/osascript", ["-e", script, ...(uuid.test(token) ? [`resume:${token}`] : [])], {
    timeout: 5000,
  });
};
