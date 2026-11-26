import { execFileSync } from "node:child_process";
// Swiss v1: a fixed launcher and a validated session ID; never accept a destination bundle from input.
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export const launchInput = (raw = ""): { query: string; returnTo: string } => {
  if (!raw.startsWith("swiss:v1:")) return { query: raw, returnTo: "" };
  try {
    if (raw.length > 2000) throw new Error();
    const value = JSON.parse(Buffer.from(raw.slice(9), "base64url").toString("utf8"));
    if (!uuid.test(value.returnTo) || typeof value.query !== "string" || value.query.length > 500)
      throw new Error();
    return { query: value.query, returnTo: value.returnTo };
  } catch {
    throw new Error("Invalid Swiss launch. Reopen the tool from Swiss.");
  }
};
export const backVariables = (key: string, raw = ""): Record<string, string> => ({
  [key]: "back",
  swiss_return: launchInput(raw).returnTo,
});
export const performBack = (token = ""): void => {
  const script = uuid.test(token)
    ? 'on run argv\ntell application id "com.runningwithcrayons.Alfred" to run trigger "open" in workflow "com.izsk.swiss" with argument (item 1 of argv)\nend run'
    : 'tell application id "com.runningwithcrayons.Alfred" to search ""';
  execFileSync("/usr/bin/osascript", ["-e", script, ...(uuid.test(token) ? [`resume:${token}`] : [])], {
    timeout: 5000,
  });
};
