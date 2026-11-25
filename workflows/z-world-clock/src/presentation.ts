import { existsSync } from "node:fs";
import { clock, matches } from "./model.ts";
import { entries, type State } from "./state.ts";
import { face } from "./face.ts";
export const rows = (s: State, now = Date.now()): Record<string, unknown>[] =>
  entries(s)
    .filter((e) => matches(e, s.query))
    .map((e) => {
      const c = clock(e.zone, now, s.prefs.hour24, s.prefs.dateFormat),
        star = s.prefs.stars.some((v) => v.id === e.id);
      return {
        uid: e.id,
        "clockImage.image.type": "file",
        "clockImage.image.src":
          s.prefs.layout === "list" && e.avatar && existsSync(e.avatar) ? e.avatar : face(c.hour, c.minute),
        "clockTitle.text": `${star ? "★ " : ""}${e.emoji ? e.emoji + " " : ""}${e.alias || e.zone.replaceAll("_", " ")}`,
        "clockTime.text": `${c.day ? "☀️" : "🌙"} ${c.time}`,
        "clockSubtitle.text":
          s.prefs.layout === "grid"
            ? `${c.difference} · ${c.utc}`
            : `${e.alias ? e.zone + " · " : ""}${c.date} · ${c.utc} · ${c.difference}`,
        "clockMemo.text": e.memo,
        "clockTitle.tooltip": `${e.alias || e.zone}\n${e.zone}${e.memo ? "\n" + e.memo : ""}`,
      };
    });
