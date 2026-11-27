import { freshSelection } from "../../../shared/dashboard.ts";
import { profileCommand } from "../../../shared/ui-profile.ts";
await profileCommand(() => import("./env.ts"));
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { profileAction } from "../../../shared/ui-profile.ts";
import { components } from "../ui/window.ts";
import {
  describe,
  devicesFor,
  hasKind,
  hiddenNames,
  isCurrent,
  readDevices,
  setDefault,
  symbol,
  type Device,
  type Kind,
} from "./devices.ts";
import { bool, str } from "./env.ts";
import { backVariables, launchInput, performBack } from "./navigation.ts";
import { create, read, save, storeSnapshot, type State } from "./state.ts";
import {
  copy,
  errorStatus,
  finish,
  menuItem,
  merge,
  popup,
  separator,
  update,
  vars,
  type Action,
} from "./ui.ts";

const visible = (s: State): Device[] =>
  devicesFor(s.snapshot, s.kind, s.query, hiddenNames(str("hidden_devices")));
const count = (s: State): string =>
  `${s.snapshot.devices.filter((d) => hasKind(d, s.kind)).length} ${s.kind} devices`;

const render = (s: State): Action => {
  const rows = visible(s);
  if (!rows.some((d) => d.uid === s.selected)) s.selected = rows[0]?.uid || "";
  save(s);
  return update(
    {
      items: {
        data: {
          src: rows.map((d) => ({
            uid: d.uid,
            "rowTitle.text": d.name,
            "rowDescription.text": describe(s.snapshot, d, s.kind),
            "rowIcon.image.type": "symbol",
            "rowIcon.image.src": symbol(d, s.kind),
            "rowIcon.contenttintcolour": isCurrent(s.snapshot, d, s.kind)
              ? "controlAccentColor"
              : "secondaryLabelColor",
          })),
        },
        select: s.selected,
        placeholder: s.snapshot.devices.length ? `No matching ${s.kind} devices` : s.status,
      },
      kind: { selected: s.kind },
      primary: { text: s.kind === "input" ? "Use as Input  ↩" : "Use as Output  ↩" },
      statusLabel: { text: s.status },
    },
    true,
  );
};
const pulse = (s: State): Action => ({
  pulse: { src: "../bin/sound", args: ["load", s.id, s.request], interval: 0, now: true },
});
const target = (s: State, uid: string): Device => {
  const d = s.snapshot.devices.find((x) => x.uid === (uid || s.selected));
  if (!d) throw new Error("Select a device.");
  return d;
};
const reload = async (s: State, status: string): Promise<Action> => {
  s.snapshot = await readDevices();
  storeSnapshot(s.snapshot);
  s.status = status;
  return render(s);
};
/** Switches the default device; switching output moves alert sounds too unless turned off. */
const use = async (s: State, d: Device): Promise<string> => {
  if (!hasKind(d, s.kind)) throw new Error(`${d.name} has no ${s.kind}.`);
  await setDefault(s.kind, d.uid);
  if (s.kind === "output" && bool("alerts_follow", true)) await setDefault("alert", d.uid);
  return `${s.kind === "input" ? "Input" : "Output"}: ${d.name}`;
};
const kindOf = (value: string | undefined): Kind => (value === "input" ? "input" : "output");

const main = async (): Promise<Action | void> => {
  const [cmd = "", id = "", ...args] = process.argv.slice(2),
    value = args[0] || "";
  if (cmd === "prepare-origin")
    return merge(vars(backVariables("sound_out", process.env.sound_query)), profileAction({ str, bool }));
  if (cmd === "post") {
    if (process.env.sound_out === "back") performBack(process.env.swiss_return);
    return;
  }
  if (cmd === "launch") {
    const origin = launchInput(process.env.sound_query || "");
    // `sound in …` / `sound input …` / `sound mic …` opens on input devices.
    const m = origin.query.match(/^(in|input|mic)\b\s*(.*)$/i);
    const s = create(m ? m[2]! : origin.query, origin.returnTo, m ? "input" : kindOf(str("start_kind")));
    return merge(
      vars({ sound_session: s.id }),
      update({ root: { components: components(s.query, s.kind) } }, true),
      render(s),
      pulse(s),
    );
  }
  const s = read(id);
  if (cmd === "back") return finish({ sound_out: "back", swiss_return: s.returnTo });
  if (cmd === "load") {
    if (value !== s.request) return {};
    try {
      const snapshot = await readDevices();
      storeSnapshot(snapshot);
      const latest = read(id);
      if (latest.request !== value) return {};
      latest.snapshot = snapshot;
      latest.status = count(latest);
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
    if (s.snapshot.devices.some((d) => d.uid === value)) {
      s.selected = value;
      save(s);
    }
    return {};
  }
  if (cmd === "kind") {
    s.kind = kindOf(value);
    s.selected = "";
    s.status = count(s);
    return render(s);
  }
  if (cmd === "refresh") {
    s.request = randomUUID();
    s.status = "Refreshing…";
    return merge(render(s), pulse(s));
  }
  // ↩ switches and closes; ⌘↩ switches and stays open to compare devices.
  if (cmd === "open") {
    await use(s, target(s, value));
    return finish({ sound_out: "done" });
  }
  if (cmd === "switch") return reload(s, await use(s, target(s, value)));
  if (cmd === "alert") {
    const d = target(s, value);
    if (!hasKind(d, "output")) throw new Error(`${d.name} has no output.`);
    await setDefault("alert", d.uid);
    return reload(s, `Alerts: ${d.name}`);
  }
  if (cmd === "copy") return copy(target(s, value).name);
  if (cmd === "settings") {
    execFileSync("/usr/bin/open", ["x-apple.systempreferences:com.apple.Sound-Settings.extension"], {
      timeout: 3000,
    });
    return finish({ sound_out: "done" });
  }
  if (cmd === "configure") {
    execFileSync(
      "/usr/bin/osascript",
      [
        "-e",
        'tell application id "com.runningwithcrayons.Alfred" to reveal workflow "com.izsk.sound" configuration true',
      ],
      { timeout: 5000 },
    );
    return {};
  }
  if (cmd === "menu") {
    const d = s.snapshot.devices.find((x) => x.uid === (value || s.selected));
    const noun = s.kind === "input" ? "Input" : "Output";
    const other: Kind = s.kind === "input" ? "output" : "input";
    return popup("actionsButton", [
      ...(d
        ? [
            menuItem(`Use as ${noun}`, ["open", id, d.uid], "↩"),
            menuItem(`Use as ${noun} and Keep Open`, ["switch", id, d.uid], "⌘↩"),
            ...(hasKind(d, "output") ? [menuItem("Use for Alert Sounds", ["alert", id, d.uid], "⌘L")] : []),
            menuItem("Copy Device Name", ["copy", id, d.uid]),
            separator,
          ]
        : []),
      menuItem(
        `Show ${other === "input" ? "Input" : "Output"} Devices`,
        ["kind", id, other],
        other === "input" ? "⌘2" : "⌘1",
      ),
      menuItem("Open Sound Settings", ["settings", id]),
      menuItem("Refresh", ["refresh", id], "⌘R"),
      menuItem("Workflow Configuration…", ["configure", id]),
    ]);
  }
  return {};
};
main()
  .then((action) => process.stdout.write(JSON.stringify(action || {}), () => process.exit(0)))
  .catch((error) => process.stdout.write(JSON.stringify(errorStatus(error)), () => process.exit(0)));
