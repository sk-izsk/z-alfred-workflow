import { expect, test } from "bun:test";
import { openTerminal, terminalPlan, terminalConfiguration } from "../../../shared/terminal.ts";
const settings = (app: string, extra: Record<string, string> = {}) => ({
  str: (key: string, fallback = "") => ({ terminal_app: app, ...extra })[key] || fallback,
});
test("terminal routing preserves commands as arguments and exposes configurable choices", () => {
  const command = "printf '%s' 'quoted $HOME `value`'";
  const ghost = terminalPlan(settings("Ghostty"), { command, cwd: "/private/tmp" });
  expect(ghost.file).toBe("/usr/bin/osascript");
  expect(ghost.args[1]).toContain("new window with configuration");
  expect(ghost.args.at(-2)).toContain(command);
  expect(ghost.args.at(-1)).toBe("/private/tmp");
  for (const app of ["Terminal", "iTerm", "WezTerm", "kitty", "Alacritty"]) {
    const plan = terminalPlan(settings(app), { command });
    expect(plan.args.at(-1)).toContain(command);
  }
  expect(terminalConfiguration().some((x) => x.variable === "terminal_app")).toBe(true);
  expect(() => terminalPlan(settings("custom"), { command })).toThrow("absolute path");
  const custom = terminalPlan(
    settings("custom", { terminal_custom: "/bin/echo", terminal_custom_args: '["{cwd}","{command}"]' }),
    { cwd: "/private/tmp", command },
  );
  expect(custom.args[0]).toBe("/private/tmp");
  expect(custom.args[1]).toContain(command);
  expect(terminalPlan(settings("Warp"), { cwd: "/private/tmp" }).args).toEqual([
    "-a",
    "Warp",
    "/private/tmp",
  ]);
});

import { standardSheet } from "../../../shared/sheet.ts";
test("sheet footers share right alignment, Escape and native Return actions", () => {
  const action = standardSheet(
    "example",
    {
      type: "view",
      layout: "border",
      components: [
        { type: "label", text: "Review" },
        {
          type: "button",
          text: "Apply",
          constraints: { region: "bottom" },
          events: [{ triggers: "actioned", action: { type: "json", src: {} } }],
        },
      ],
    },
    false,
  ) as any;
  expect(action.sheet.closeonescape).toBe(true);
  expect(action.sheet.root.components[0].components).toHaveLength(1);
  const footer = action.sheet.root.components[1];
  expect(footer.constraints.position).toBe("right");
  expect(footer.components[0].text).toContain("Back");
  expect(footer.components[1].text).toBe("Apply");
  expect(footer.components[1].bordered).toBe(false);
  expect(footer.components[1].shortcut).toBe("↩");
});

import { mkdtempSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
test("custom terminal launch returns without waiting for the terminal process to exit", async () => {
  const dir = mkdtempSync(join(tmpdir(), "terminal-launch-")),
    file = join(dir, "launcher"),
    marker = join(dir, "done");
  writeFileSync(file, '#!/bin/sh\n/bin/sleep 0.5\n/usr/bin/touch "$1"\n', { mode: 0o700 });
  try {
    await openTerminal(
      settings("custom", { terminal_custom: file, terminal_custom_args: JSON.stringify([marker]) }),
      {},
    );
    expect(existsSync(marker)).toBe(false);
    const end = Date.now() + 4000;
    while (!existsSync(marker) && Date.now() < end) await Bun.sleep(30);
    expect(existsSync(marker)).toBe(true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
