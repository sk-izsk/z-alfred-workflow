import { randomUUID } from "node:crypto";
import { results } from "./engine.ts";
import { create, read, save, type State } from "./state.ts";
import { components } from "../ui/window.ts";
import {
  print,
  merge,
  update,
  vars,
  errorStatus,
  popup,
  menuItem,
  copy,
  open,
  finish,
  type Action,
} from "./ui.ts";
import { osascript } from "./proc.ts";
const populate = (s: State): Action =>
  update({
    items: {
      data: {
        src: s.results.map((r) => ({
          uid: r.uid,
          "rowFlag.text": "🧮",
          "rowTitle.text": r.title,
          "rowDescription.text": r.subtitle,
          "rowCountry.text": "",
        })),
      },
      select: s.results.some((r) => r.uid === s.selected) ? s.selected : s.results[0]?.uid || "",
    },
  });
const screen = (s: State): Action =>
  merge(vars({ calcany_session: s.id }), update({ root: { components: components(s) } }, true), {
    pulse: { src: "../bin/calcany", args: ["populate", s.id], interval: 0, now: true },
  });
const load = async (s: State): Promise<Action> => {
  const ticket = randomUUID();
  s.request = ticket;
  save(s);
  const output = await results(s.query),
    latest = read(s.id);
  if (latest.request !== ticket) return {};
  latest.results = output;
  save(latest);
  return merge(
    screen(latest),
    output.length
      ? {}
      : update({ statusLabel: { text: "No result. Try 100 km in miles, 2 GB in MB, or 100 + 16%." } }, true),
  );
};
const main = async (): Promise<Action | void> => {
  const [cmd = "", id = "", ...args] = process.argv.slice(2);
  if (cmd === "post") {
    if (process.env.calcany_out === "back")
      await osascript('tell application id "com.runningwithcrayons.Alfred" to search (item 1 of argv)', "");
    return;
  }
  if (cmd === "launch") {
    const s = create(process.env.calcany_query || "");
    return merge(vars({ calcany_session: s.id }), s.query ? await load(s) : screen(s));
  }
  const s = read(id),
    selected = args[0] || s.selected;
  if (cmd === "back") return finish({ calcany_out: "back" });
  if (cmd === "populate") return populate(s);
  if (cmd === "select") {
    s.selected = selected;
    save(s);
    return {};
  }
  if (cmd === "query") {
    s.query = args[0] || "";
    save(s);
    return load(s);
  }
  if (cmd === "refresh") return load(s);
  if (cmd === "website") return open("https://github.com/biati-digital/alfred-calculate-anything");
  if (cmd === "menu")
    return popup("actionsButton", [
      menuItem("Copy Result", ["copy", id, selected], "↩"),
      menuItem("Copy Without Formatting", ["copy-raw", id, selected]),
      menuItem("Copy Alternate Result", ["copy-single", id, selected]),
      menuItem("Recalculate", ["refresh", id], "⌘R"),
      menuItem("Calculate Anything Documentation", ["website", id]),
    ]);
  if (["copy", "copy-raw", "copy-single"].includes(cmd)) {
    const result = s.results.find((r) => r.uid === selected);
    if (!result) throw new Error("Select a calculation result.");
    return copy(cmd === "copy-raw" ? result.raw : cmd === "copy-single" ? result.single : result.value);
  }
  throw new Error("Unknown calculator command.");
};
try {
  const result = await main();
  if (result) print(result);
} catch (error) {
  print(errorStatus(error));
}
