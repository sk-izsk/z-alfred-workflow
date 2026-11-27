import { freshSelection } from "../../../shared/dashboard.ts";
import { profileCommand } from "../../../shared/ui-profile.ts";
await profileCommand(() => import("./env.ts"));
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { profileAction } from "../../../shared/ui-profile.ts";
import { components } from "../ui/window.ts";
import {
  describeDisplay,
  describeMode,
  matchesDisplay,
  matchesMode,
  readDisplays,
  resolution,
  sameMode,
  setDark,
  setMain,
  setMirror,
  setMode,
  sortDisplays,
  sortModes,
  type Display,
} from "./displays.ts";
import { bool, str } from "./env.ts";
import { backVariables, launchInput, performBack } from "./navigation.ts";
import { create, read, save, storeSnapshot, type State } from "./state.ts";
import { errorStatus, finish, menuItem, merge, popup, separator, update, vars, type Action } from "./ui.ts";

const displayOf = (s: State, id = s.display): Display => {
  const d = s.snapshot.displays.find((x) => x.id === id);
  if (!d) throw new Error("That display is no longer connected.");
  return d;
};
const rowsFor = (s: State) => {
  if (s.screen === "modes") {
    const d = s.snapshot.displays.find((x) => x.id === s.display);
    if (!d) return [];
    return sortModes(d.modes)
      .filter((m) => matchesMode(m, d.current, s.query))
      .map((m) => ({
        uid: `m${m.id}`,
        "rowTitle.text": resolution(m),
        "rowDescription.text": describeMode(m, d.current),
        "rowIcon.image.type": "symbol",
        "rowIcon.image.src": sameMode(d.current, m) ? "checkmark.circle.fill" : "rectangle",
        "rowIcon.contenttintcolour": sameMode(d.current, m) ? "controlAccentColor" : "secondaryLabelColor",
      }));
  }
  const all = s.snapshot.displays;
  return sortDisplays(all)
    .filter((d) => matchesDisplay(d, all, s.query))
    .map((d) => ({
      uid: `d${d.id}`,
      "rowTitle.text": d.name,
      "rowDescription.text": describeDisplay(d, all),
      "rowIcon.image.type": "symbol",
      "rowIcon.image.src": d.builtin ? "laptopcomputer" : d.mirrorOf ? "rectangle.on.rectangle" : "display",
      "rowIcon.contenttintcolour": d.main ? "controlAccentColor" : "secondaryLabelColor",
    }));
};

const render = (s: State, replaceQuery = false): Action => {
  const rows = rowsFor(s);
  if (!rows.some((r) => r.uid === s.selected)) s.selected = rows[0]?.uid || "";
  save(s);
  const modes = s.screen === "modes";
  return update(
    {
      items: {
        data: { src: rows },
        select: s.selected,
        placeholder: s.snapshot.displays.length ? "Nothing matches" : s.status,
      },
      ...(replaceQuery && {
        query: {
          text: s.query,
          placeholder: modes ? `Search ${displayOf(s).name} resolutions…` : "Search displays…",
        },
      }),
      primary: { text: modes ? "Use Resolution  ↩" : "Resolutions  ↩" },
      statusLabel: { text: s.status },
    },
    true,
  );
};
const pulse = (s: State): Action => ({
  pulse: { src: "../bin/displays", args: ["load", s.id, s.request], interval: 0, now: true },
});
const reload = async (s: State, status: string): Promise<Action> => {
  s.snapshot = await readDisplays();
  storeSnapshot(s.snapshot);
  s.status = status;
  return render(s);
};
const count = (s: State) =>
  `${s.snapshot.displays.length} display${s.snapshot.displays.length === 1 ? "" : "s"} · ${s.snapshot.dark ? "Dark" : "Light"} Mode`;
/** The display a command acts on: the row's display, or the one whose modes are shown. */
const targetDisplay = (s: State, uid: string): Display =>
  s.screen === "modes" ? displayOf(s) : displayOf(s, Number((uid || s.selected).replace(/^d/, "")));

/** Switches the shown display to a mode, remembering the old one for ⌘Z. */
const useMode = async (s: State, uid: string): Promise<Action> => {
  const d = displayOf(s);
  const modeId = Number((uid || s.selected).replace(/^m/, ""));
  const mode = d.modes.find((m) => m.id === modeId);
  if (!mode) throw new Error("Select a resolution.");
  if (sameMode(d.current, mode)) return reload(s, `${d.name} already uses ${resolution(mode)}`);
  if (d.current) s.undo = { display: d.id, mode: d.current.id };
  await setMode(d.id, mode.id);
  return reload(s, `${d.name}: ${resolution(mode)}, ${describeMode(mode, null)} · ⌘Z to undo`);
};
const openModes = (s: State, uid: string): Action => {
  const d = targetDisplay(s, uid);
  s.parent = { query: s.query, selected: `d${d.id}` };
  s.screen = "modes";
  s.display = d.id;
  s.query = "";
  s.selected = d.current ? `m${d.current.id}` : "";
  s.status = `${d.modes.length} resolutions for ${d.name}`;
  return render(s, true);
};

const main = async (): Promise<Action | void> => {
  const [cmd = "", id = "", ...args] = process.argv.slice(2),
    value = args[0] || "";
  if (cmd === "prepare-origin")
    return merge(
      vars(backVariables("displays_out", process.env.displays_query)),
      profileAction({ str, bool }),
    );
  if (cmd === "post") {
    if (process.env.displays_out === "back") performBack(process.env.swiss_return);
    return;
  }
  if (cmd === "launch") {
    const origin = launchInput(process.env.displays_query || "");
    const s = create(origin.query, origin.returnTo);
    return merge(
      vars({ displays_session: s.id }),
      update({ root: { components: components(s.query) } }, true),
      render(s),
      pulse(s),
    );
  }
  const s = read(id);
  // Back: the resolution list returns to the display list; the display list leaves.
  if (cmd === "back") {
    if (s.screen === "modes") {
      s.screen = "displays";
      s.query = s.parent?.query ?? "";
      s.selected = s.parent?.selected ?? "";
      s.status = count(s);
      return render(s, true);
    }
    return finish({ displays_out: "back", swiss_return: s.returnTo });
  }
  if (cmd === "load") {
    if (value !== s.request) return {};
    try {
      const snapshot = await readDisplays();
      storeSnapshot(snapshot);
      const latest = read(id);
      if (latest.request !== value) return {};
      latest.snapshot = snapshot;
      if (latest.screen === "displays") latest.status = count(latest);
      return render(latest);
    } catch (error) {
      const latest = read(id);
      latest.status = error instanceof Error ? error.message : String(error);
      return render(latest);
    }
  }
  if (cmd === "query") {
    s.query = value;
    return render(s);
  }
  if (cmd === "select") {
    if (!freshSelection(s)) return {};
    s.selected = value;
    save(s);
    return {};
  }
  if (cmd === "refresh") {
    s.request = randomUUID();
    s.status = "Refreshing…";
    return merge(render(s), pulse(s));
  }
  if (cmd === "open") return s.screen === "modes" ? useMode(s, value) : openModes(s, value);
  if (cmd === "undo") {
    if (!s.undo) throw new Error("Nothing to undo.");
    const { display, mode } = s.undo;
    s.undo = undefined;
    await setMode(display, mode);
    return reload(s, "Resolution restored");
  }
  if (cmd === "main") {
    const d = targetDisplay(s, value);
    if (d.main) return reload(s, `${d.name} is already the main display`);
    await setMain(d.id);
    return reload(s, `${d.name} is now the main display`);
  }
  if (cmd === "mirror") {
    const d = targetDisplay(s, value);
    await setMirror(d.id, !d.mirrorOf);
    return reload(s, d.mirrorOf ? `${d.name} no longer mirrors` : `${d.name} mirrors the main display`);
  }
  if (cmd === "dark") {
    const { dark } = await setDark("toggle");
    return reload(s, dark ? "Dark Mode on" : "Light Mode on");
  }
  if (cmd === "settings") {
    execFileSync("/usr/bin/open", ["x-apple.systempreferences:com.apple.Displays-Settings.extension"], {
      timeout: 3000,
    });
    return finish({ displays_out: "done" });
  }
  if (cmd === "configure") {
    execFileSync(
      "/usr/bin/osascript",
      [
        "-e",
        'tell application id "com.runningwithcrayons.Alfred" to reveal workflow "com.izsk.displays" configuration true',
      ],
      { timeout: 5000 },
    );
    return {};
  }
  if (cmd === "menu") {
    const d = s.snapshot.displays.length ? targetDisplay(s, value) : undefined;
    const several = s.snapshot.displays.length > 1;
    return popup("actionsButton", [
      ...(s.screen === "modes"
        ? [menuItem("Use Resolution", ["open", id, value || s.selected], "↩")]
        : d
          ? [menuItem("Show Resolutions", ["open", id, `d${d.id}`], "↩")]
          : []),
      ...(s.undo ? [menuItem("Undo Resolution Change", ["undo", id], "⌘Z")] : []),
      ...(d && several && !d.main
        ? [menuItem(`Make ${d.name} the Main Display`, ["main", id, `d${d.id}`], "⌘M")]
        : []),
      ...(d && several && !d.main
        ? [menuItem(d.mirrorOf ? "Stop Mirroring" : "Mirror the Main Display", ["mirror", id, `d${d.id}`])]
        : []),
      separator,
      menuItem(s.snapshot.dark ? "Turn Off Dark Mode" : "Turn On Dark Mode", ["dark", id], "⌘D"),
      menuItem("Open Displays Settings", ["settings", id]),
      menuItem("Refresh", ["refresh", id], "⌘R"),
      menuItem("Workflow Configuration…", ["configure", id]),
    ]);
  }
  return {};
};
main()
  .then((action) => process.stdout.write(JSON.stringify(action || {}), () => process.exit(0)))
  .catch((error) => process.stdout.write(JSON.stringify(errorStatus(error)), () => process.exit(0)));
