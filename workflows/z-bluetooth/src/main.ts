import { profileCommand, profileAction } from "../../../shared/ui-profile.ts";
await profileCommand(() => import("./env.ts"));
import { execFileSync } from "node:child_process";
import { str, bool } from "./env.ts";
import { create, read, save, type State } from "./state.ts";
import { scan, connect } from "./bluetooth.ts";
import { components } from "../ui/window.ts";
import { launchInput, backVariables, performBack } from "./navigation.ts";
import { merge, vars, update, finish, popup, menuItem, copy, open, errorStatus, type Action } from "./ui.ts";
const render = (s: State): Action => {
  const rows = s.rows.filter(
    (d) =>
      (s.filter === "All" || d.connected === (s.filter === "Connected")) &&
      `${d.name} ${d.type} ${d.id}`.toLowerCase().includes(s.query.toLowerCase()),
  );
  if (!rows.some((d) => d.id === s.selected)) s.selected = rows[0]?.id || "";
  save(s);
  const selected = rows.find((d) => d.id === s.selected);
  return update(
    {
      items: {
        data: {
          src: rows.map((d) => ({
            uid: d.id,
            "rowIcon.image.type": "symbol",
            "rowIcon.image.src": /head|airpod/i.test(d.type + " " + d.name)
              ? "headphones"
              : /key/i.test(d.type)
                ? "keyboard"
                : "antenna.radiowaves.left.and.right",
            "rowTitle.text": d.name,
            "rowDescription.text": `${d.connected ? "Connected" : "Disconnected"} · ${d.type}${d.battery ? " · " + d.battery : ""}`,
          })),
        },
        select: s.selected,
        placeholder: "No paired Bluetooth devices found.",
      },
      filter: {
        items: ["All", "Connected", "Disconnected"].map((value) => ({ text: value, value })),
        selected: s.filter,
      },
      primary: { text: selected?.connected ? "Disconnect  ↩" : "Connect  ↩" },
      statusLabel: {
        text: `${s.rows.length} paired · ${s.paused ? "Paused" : new Date().toLocaleTimeString()}`,
      },
    },
    true,
  );
};
const load = async (s: State): Promise<Action> => {
  const rows = await scan(),
    current = read(s.id);
  current.rows = rows;
  return render(current);
};
const main = async (): Promise<Action | void> => {
  const [cmd = "", id = "", value = ""] = process.argv.slice(2);
  if (cmd === "prepare-origin")
    return merge(
      vars(backVariables("bluetooth_out", process.env.bluetooth_query)),
      profileAction({ str, bool }),
    );
  if (cmd === "post") {
    if (process.env.bluetooth_out === "back") performBack(process.env.dev_return);
    return;
  }
  if (cmd === "launch") {
    const origin = launchInput(process.env.bluetooth_query),
      s = create(origin.query, origin.returnTo);
    return merge(
      vars({ bluetooth_session: s.id }),
      update({ root: { components: components(s.query) } }, true),
      {
        pulse: {
          src: "../bin/bluetooth",
          args: ["tick", s.id],
          interval: Math.min(60, Math.max(2, Number(str("refresh_seconds", "10")) || 10)),
          now: true,
        },
      },
    );
  }
  const s = read(id);
  if (cmd === "tick") return s.paused ? {} : load(s);
  if (cmd === "refresh") return load(s);
  if (cmd === "query") {
    s.query = value;
    return render(s);
  }
  if (cmd === "filter") {
    s.filter = value;
    return render(s);
  }
  if (cmd === "select") {
    s.selected = value;
    save(s);
    return update(
      { primary: { text: s.rows.find((d) => d.id === value)?.connected ? "Disconnect  ↩" : "Connect  ↩" } },
      true,
    );
  }
  if (cmd === "pause") {
    s.paused = !s.paused;
    save(s);
    return render(s);
  }
  if (cmd === "back") return finish({ bluetooth_out: "back", dev_return: s.returnTo });
  if (cmd === "settings") return open("x-apple.systempreferences:com.apple.BluetoothSettings");
  if (cmd === "configure") {
    execFileSync(
      "/usr/bin/osascript",
      [
        "-e",
        'tell application id "com.runningwithcrayons.Alfred" to reveal workflow "com.izsk.bluetooth" configuration true',
      ],
      { timeout: 5000 },
    );
    return {};
  }
  const d = s.rows.find((x) => x.id === (value || s.selected));
  if (cmd === "menu")
    return popup("actionsButton", [
      ...(d
        ? [
            menuItem(d.connected ? "Disconnect" : "Connect", ["open", id, d.id]),
            menuItem("Copy MAC Address", ["copy", id, d.id]),
            menuItem("Copy Device Data", ["data", id, d.id]),
          ]
        : []),
      menuItem("Refresh Devices", ["refresh", id]),
      menuItem(s.paused ? "Resume Refresh" : "Pause Refresh", ["pause", id]),
      menuItem("Bluetooth Settings…", ["settings", id]),
      menuItem("Workflow Configuration…", ["configure", id]),
    ]);
  if (!d) throw new Error("Select a Bluetooth device.");
  if (cmd === "copy") return copy(d.id);
  if (cmd === "data") return copy(JSON.stringify(d, null, 2));
  if (cmd === "open") {
    await connect(d.id, !d.connected);
    return load(s);
  }
  return {};
};
main()
  .then((a) => process.stdout.write(JSON.stringify(a || {})))
  .catch((e) => process.stdout.write(JSON.stringify(errorStatus(e))));
