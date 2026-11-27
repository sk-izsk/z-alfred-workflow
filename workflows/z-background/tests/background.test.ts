import { expect, test } from "bun:test";
import {
  adminShell,
  describe,
  inFilter,
  matches,
  ownerOf,
  parseDisabled,
  parseList,
  parsePrint,
  sortItems,
  type Item,
} from "../src/items.ts";

const item = (name: string, extra: Partial<Item> = {}): Item => ({
  id: `user-agent:${name}`,
  group: "user-agent",
  name,
  owner: name,
  label: name,
  loaded: false,
  running: false,
  disabled: false,
  missing: false,
  ...extra,
});

test("parses launchctl list, print-disabled and print", () => {
  const list = parseList("PID\tStatus\tLabel\n824\t0\tcom.example.sync\n-\t0\tcom.example.updater\n");
  expect([...list]).toEqual([
    ["com.example.sync", 824],
    ["com.example.updater", 0],
  ]);
  const disabled = parseDisabled(
    'disabled services = {\n\t"com.example.a" => enabled\n\t"com.example.b" => disabled\n}',
  );
  expect([...disabled]).toEqual(["com.example.b"]);
  expect(parsePrint("system/x = {\n\tstate = running\n\tpid = 562\n}")).toEqual({ running: true, pid: 562 });
  expect(parsePrint("system/x = {\n\tstate = not running\n}")).toEqual({ running: false, pid: undefined });
});

test("owner comes from the app in the program path, else a vendor from the label", () => {
  expect(ownerOf("/Applications/Notes Helper.app/Contents/MacOS/helper", "com.example.helper")).toBe(
    "Notes Helper",
  );
  expect(ownerOf("/opt/homebrew/opt/postgresql/bin/postgres", "homebrew.mxcl.postgresql")).toBe("Homebrew");
  expect(ownerOf("/Library/Vendor/updater", "com.google.keystone.agent")).toBe("Google");
  expect(ownerOf(undefined, "com.acme.sync")).toBe("Acme");
});

test("leftovers first, then login items, agents and daemons; filters and search", () => {
  const login = item("Notes", { id: "login:Notes", group: "login", label: undefined, running: true });
  const agent = item("Sync", { owner: "Example", label: "com.example.sync", running: true, pid: 824 });
  const daemon = item("com.example.daemon", {
    id: "daemon:x",
    group: "daemon",
    owner: "Example",
    loaded: true,
  });
  const leftover = item("com.gone.updater", {
    id: "daemon:gone",
    group: "daemon",
    missing: true,
    owner: "Gone",
  });
  expect(sortItems([daemon, agent, login, leftover]).map((x) => x.name)).toEqual([
    "com.gone.updater",
    "Notes",
    "Sync",
    "com.example.daemon",
  ]);
  expect(describe(agent)).toBe("Running (PID 824) · Example · Your Agent · com.example.sync");
  expect(describe(daemon)).toBe("Loaded · Example · Daemon");
  expect(describe(leftover)).toBe("Program missing · Gone · Daemon");
  expect(inFilter(leftover, "leftovers") && !inFilter(agent, "leftovers")).toBe(true);
  expect(inFilter(agent, "agents") && !inFilter(login, "agents")).toBe(true);
  expect(matches(agent, "example running")).toBe(true);
});

test("administrator commands are quoted for the shell", () => {
  expect(
    adminShell([
      ["disable", "system/com.example.d"],
      ["bootout", "system/com.example.d"],
    ]),
  ).toBe(
    "'/bin/launchctl' 'disable' 'system/com.example.d'; '/bin/launchctl' 'bootout' 'system/com.example.d'",
  );
  expect(adminShell([["bootstrap", "system", "/Library/LaunchDaemons/it's.plist"]])).toContain(
    "'/Library/LaunchDaemons/it'\\''s.plist'",
  );
});
