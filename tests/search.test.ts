import { expect, spyOn, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tick } from "../src/commands/search.ts";
import * as session from "../src/session.ts";
import { toMeta } from "../src/vault.ts";

test("row TOTP turns red at 5 seconds and resets on rotation without refreshing every second", async () => {
  const dir = mkdtempSync(join(tmpdir(), "bwa-totp-"));
  const saved = { ...process.env };
  const clock = spyOn(Date, "now");
  const valid = spyOn(session, "windowValid").mockResolvedValue(true);
  try {
    process.env.alfred_workflow_cache = dir;
    process.env.alfred_workflow_data = dir;
    process.env.totp_display = "row";
    process.env.window_session = "dummy";
    process.env.totp_seeds = JSON.stringify({ login: "JBSWY3DPEHPK3PXP" });
    delete process.env.totp_period;
    writeFileSync(
      join(dir, "cache.json"),
      JSON.stringify({
        syncedAt: 0,
        folders: [],
        items: [
          toMeta({
            id: "login",
            name: "Test",
            type: 1,
            folderId: null,
            favorite: false,
            reprompt: 0,
            notes: null,
          }),
        ],
      }),
    );
    const at = async (now: number) => {
      clock.mockReturnValue(now);
      const action = await tick([]);
      if (action.variables) Object.assign(process.env, action.variables);
      return action as {
        update: {
          ids: {
            items?: { data: { modify: { replace: { srcmap: Record<string, Record<string, unknown>> } } } };
          };
        };
      };
    };
    const row = (action: Awaited<ReturnType<typeof at>>) =>
      action.update.ids.items?.data.modify.replace.srcmap.login;
    expect(row(await at(24_000))?.["rowCode.colour"]).toBe("labelColor");
    expect(row(await at(25_000))?.["rowCode.colour"]).toBe("systemRedColor");
    expect((await at(26_000)).update.ids.items).toBeUndefined();
    expect(row(await at(30_000))?.["rowCode.colour"]).toBe("labelColor");
  } finally {
    clock.mockRestore();
    valid.mockRestore();
    process.env = saved;
    rmSync(dir, { recursive: true, force: true });
  }
});
