import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agentPlist, parseScreenLocked } from "../src/agent.ts";
import { addressBarUrl } from "../src/browser.ts";
import { BwError } from "../src/bw.ts";
import { loginHint } from "../src/commands/account.ts";

test("a locked screen is read from ioreg, and anything else counts as unlocked", () => {
  expect(parseScreenLocked("<key>IOConsoleLocked</key>\n\t<true/>")).toBe(true);
  expect(parseScreenLocked("<key>IOConsoleLocked</key>\n\t<false/>")).toBe(false);
  expect(parseScreenLocked("")).toBe(false);
});

test("the agent plist is valid and keeps hostile paths out of the shell script", () => {
  const launcher = `/tmp/a "b" & $(touch pwned)/bwa`;
  const xml = agentPlist(launcher, "/tmp/x.plist", "gui/501/com.izsk.bitwarden.agent");
  const file = join(mkdtempSync(join(tmpdir(), "bwa-")), "agent.plist");
  writeFileSync(file, xml);
  const parsed = JSON.parse(
    execFileSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", file], { encoding: "utf8" }),
  );
  // The script is fixed; the paths only arrive as positional arguments.
  expect(parsed.ProgramArguments.slice(0, 3)).toEqual([
    "/bin/sh",
    "-c",
    'if [ -x "$1" ]; then exec "$1" agent-tick; else rm -f "$2"; /bin/launchctl bootout "$3"; fi',
  ]);
  expect(parsed.ProgramArguments[4]).toBe(launcher);
  expect(parsed.StartInterval).toBe(30);
});

test("Firefox's address bar becomes a URL only when it holds a host", () => {
  expect(addressBarUrl("example.com/login")).toBe("https://example.com/login");
  expect(addressBarUrl("https://github.com")).toBe("https://github.com");
  expect(addressBarUrl("how to reset password")).toBe("");
  expect(addressBarUrl("")).toBe("");
});

test("bw's login errors turn into the next step", () => {
  const required = new BwError("Code is required.");
  expect(loginHint(required, false)).toContain("needs a code");
  expect(loginHint(required, true)).toContain("didn't accept");
  expect(loginHint(new BwError("Login failed. No provider selected."), false)).toContain("Pick one");
});
