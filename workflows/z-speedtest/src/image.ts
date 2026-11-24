import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { constants, copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { dashboardSvg } from "./charts.ts";
import { cacheDir } from "./env.ts";
import { theme } from "./svg.ts";
import type { State } from "./model.ts";
const exec = promisify(execFile);
const setClipboard =
  "on run argv\nset the clipboard to (read (POSIX file (item 1 of argv)) as «class PNGf»)\nend run";
export const imageAction = async (state: State, mode: string): Promise<Record<string, unknown>> => {
  if (!["copy", "paste", "save"].includes(mode)) throw new Error("Unknown image action");
  const markup = dashboardSvg(state);
  const match = markup.match(/^<svg[^>]*\bwidth="([\d.]+)"\s+height="([\d.]+)"[^>]*>([\s\S]*)<\/svg>\s*$/);
  if (!match) throw new Error("Unexpected meter markup");
  const width = Number(match[1]) + 32,
    height = Number(match[2]) + 32,
    top = (width - height) / 2;
  const dir = mkdtempSync(join(tmpdir(), "alfred-speedtest-image-"));
  try {
    const source = join(dir, "meter.svg"),
      png = join(dir, "meter.png");
    writeFileSync(
      source,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${width}" viewBox="0 0 ${width} ${width}"><rect y="${top}" width="${width}" height="${height}" rx="18" fill="${theme.isDark ? "#1c1c1e" : "#ffffff"}"/><g transform="translate(16,${top + 16})">${match[3]}</g></svg>`,
    );
    await exec("/usr/bin/qlmanage", ["-t", "-s", String(width * 2), "-o", dir, source], { timeout: 20_000 });
    if (!existsSync(`${source}.png`)) throw new Error("QuickLook could not render the meter");
    await exec(
      "/usr/bin/sips",
      ["-c", String(Math.round(height * 2)), String(width * 2), `${source}.png`, "--out", png],
      { timeout: 20_000 },
    );
    if (mode === "save") {
      const downloads = join(homedir(), "Downloads");
      mkdirSync(downloads, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      for (let n = 0; n < 100; n++) {
        try {
          copyFileSync(
            png,
            join(downloads, `speedtest-${stamp}${n ? `-${n}` : ""}.png`),
            constants.COPYFILE_EXCL,
          );
          return { update: { ids: { primaryButton: { text: "Saved to Downloads" } } } };
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        }
      }
      throw new Error("Could not find an unused filename");
    }
    const stable = join(cacheDir(), "speedtest-meter.png");
    copyFileSync(png, stable);
    await exec("/usr/bin/osascript", ["-e", setClipboard, stable], { timeout: 5000 });
    return mode === "paste"
      ? { finish: { variables: { speedtest_out: "paste" } } }
      : { update: { ids: { primaryButton: { text: "Meter image copied" } } } };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};
