import { execFileSync } from "node:child_process";
import { profileAction } from "../../../shared/ui-profile.ts";
import { str, bool } from "./env.ts";
import { create, read, save, type State } from "./state.ts";
import { fetchState, run, setArgs, modes, presetName } from "./lunar.ts";
import { components } from "../ui/window.ts";
import { launchInput, backVariables, performBack } from "./navigation.ts";
import { merge, vars, update, finish, popup, menuItem, sheet, errorStatus, type Action } from "./ui.ts";
const selectedDisplay = (s: State) => s.displays.find((d) => d.id === s.selected);
const controls = (s: State): Action => {
  const d = selectedDisplay(s);
  return merge(
    vars({ lunarui_display: d?.id || "" }),
    update(
      {
        displayTitle: { text: d?.name || "No displays" },
        brightness: { text: d?.brightness === null ? "" : String(d?.brightness ?? "") },
        contrast: { text: d?.contrast === null ? "" : String(d?.contrast ?? "") },
        volume: { text: d?.volume === null ? "" : String(d?.volume ?? "") },
        inputPicker: {
          items: [
            { text: "Video input…", value: "" },
            ...(d?.inputs || []).map((name) => ({ text: name, value: name })),
          ],
          selected: "",
        },
        modePicker: { selected: s.adaptive },
        presetPicker: {
          items: [
            { text: "Apply saved preset…", value: "" },
            ...s.presets.map((name) => ({ text: name, value: name })),
          ],
          selected: "",
        },
        controlInfo: {
          text: d
            ? `${d.controlMethod} · ${d.hasDDC ? "DDC available" : "DDC unavailable"} · ${d.active ? "Active" : "Inactive"}`
            : "Lunar must be running and reachable.",
        },
        statusLabel: { text: s.status },
      },
      true,
    ),
  );
};
const render = (s: State): Action => {
  const visible = s.displays.filter((d) => d.name.toLowerCase().includes(s.query.toLowerCase()));
  if (!visible.some((d) => d.id === s.selected)) s.selected = visible[0]?.id || "";
  save(s);
  return merge(
    update(
      {
        items: {
          data: {
            src: visible.map((d) => ({
              uid: d.id,
              "rowTitle.text": d.name,
              "rowDescription.text": `☀ ${d.brightness ?? "—"}% · ◐ ${d.contrast ?? "—"}% · ♪ ${d.volume ?? "—"}%`,
              "rowIcon.image.src": "display",
            })),
          },
          select: s.selected,
          placeholder: "No matching displays",
        },
      },
      true,
    ),
    controls(s),
  );
};
const refresh = async (s: State): Promise<Action> => {
  const data = await fetchState(),
    latest = read(s.id);
  Object.assign(latest, data);
  latest.status = `${data.displays.length} displays · Updated ${new Date().toLocaleTimeString()}`;
  save(latest);
  return render(latest);
};
const main = async (): Promise<Action | void> => {
  const [cmd = "", id = "", ...args] = process.argv.slice(2),
    value = args[0] || "";
  if (cmd === "prepare-origin")
    return merge(vars(backVariables("lunarui_out", process.env.lunarui_query)), profileAction({ str, bool }));
  if (cmd === "post") {
    if (process.env.lunarui_out === "back") performBack(process.env.swiss_return);
    return;
  }
  if (cmd === "launch") {
    const origin = launchInput(process.env.lunarui_query),
      s = create(origin.query, origin.returnTo);
    return merge(
      vars({ lunarui_session: s.id }),
      update({ root: { components: components(s.query) } }, true),
      { pulse: { src: "../bin/lunarui", args: ["refresh", s.id], interval: 0, now: true } },
    );
  }
  const s = read(id);
  if (cmd === "back") return finish({ lunarui_out: "back", swiss_return: s.returnTo });
  if (cmd === "refresh") return refresh(s);
  if (cmd === "query") {
    s.query = value;
    save(s);
    return render(s);
  }
  if (cmd === "select") {
    if (s.selected === value || !s.displays.some((d) => d.id === value)) return {};
    s.selected = value;
    save(s);
    return controls(s);
  }
  if (cmd === "set") {
    if (args[2] !== s.selected || !selectedDisplay(s))
      throw new Error("Select a current display before changing a value.");
    await run(setArgs(s.selected, value, args[1] || ""));
    return refresh(s);
  }
  if (cmd === "input") {
    if (!value) return {};
    if (args[1] !== s.selected || !selectedDisplay(s)?.inputs.includes(value))
      throw new Error("Choose a supported input for this display.");
    await run(["set", "-d", s.selected, "-i", value]);
    return refresh(s);
  }
  if (cmd === "adaptive") {
    if (value === s.adaptive) return {};
    if (!modes.includes(value)) throw new Error("Unsupported adaptive mode.");
    await run(["adaptive", value]);
    return refresh(s);
  }
  if (cmd === "preset") {
    if (!value) return {};
    if (!s.presets.includes(value)) throw new Error("Select a saved preset.");
    await run(["preset", "apply", value]);
    return refresh(s);
  }
  if (cmd === "save-preset")
    return sheet("presetSheet", {
      type: "view",
      layout: "border",
      padding: 18,
      spacing: 12,
      components: [
        { type: "label", text: "Save current display setup", constraints: { region: "top" } },
        {
          id: "presetName",
          type: "textfield",
          placeholder: "New preset name",
          focus: true,
          constraints: { region: "centre", size: { width: 450 } },
          events: [
            {
              triggers: "actioned",
              action: { type: "script", src: "../bin/lunarui", args: ["save", id, "{value:self.text}"] },
            },
          ],
        },
        {
          type: "button",
          text: "Save Preset",
          constraints: { region: "bottom" },
          events: [
            {
              triggers: "actioned",
              action: {
                type: "script",
                src: "../bin/lunarui",
                args: ["save", id, "{value:presetName.text}"],
              },
            },
          ],
        },
      ],
    });
  if (cmd === "save") {
    const name = presetName(value);
    if (s.presets.includes(name)) throw new Error("That preset exists. Choose a new name to preserve it.");
    await run(["preset", "save", name]);
    return merge({ sheet: { close: "presetSheet" } }, await refresh(s));
  }
  if (cmd === "power-on") {
    if (!selectedDisplay(s)) throw new Error("Select a display.");
    await run(["power", "on", "-d", s.selected]);
    return refresh(s);
  }
  if (cmd === "power-off")
    return sheet("powerSheet", {
      type: "view",
      layout: "border",
      padding: 18,
      spacing: 15,
      components: [
        {
          type: "label",
          text: `Turn off ${selectedDisplay(s)?.name || "selected display"}?`,
          constraints: { region: "top" },
        },
        {
          type: "label",
          text: "Use Power On in Actions or Lunar to restore it.",
          constraints: { region: "centre", size: { width: 450 } },
        },
        {
          type: "button",
          text: "Turn Off Selected Display",
          constraints: { region: "bottom" },
          events: [
            {
              triggers: "actioned",
              action: { type: "script", src: "../bin/lunarui", args: ["off-confirm", id, s.selected] },
            },
          ],
        },
      ],
    });
  if (cmd === "off-confirm") {
    if (value !== s.selected || !selectedDisplay(s))
      throw new Error("Display selection changed; review again.");
    await run(["power", "off", "-d", s.selected]);
    return merge({ sheet: { close: "powerSheet" } }, await refresh(s));
  }
  if (cmd === "night") {
    if (!["on", "off"].includes(value)) throw new Error("Choose on or off.");
    await run(["night", value]);
    return refresh(s);
  }
  if (cmd === "open") {
    execFileSync("/usr/bin/open", ["-b", "fyi.lunar.Lunar"], { timeout: 3000 });
    return {};
  }
  if (cmd === "configure") {
    execFileSync(
      "/usr/bin/osascript",
      [
        "-e",
        'tell application id "com.runningwithcrayons.Alfred" to reveal workflow "com.izsk.lunar" configuration true',
      ],
      { timeout: 5000 },
    );
    return {};
  }
  if (cmd === "menu")
    return popup("actionsButton", [
      menuItem("Open Lunar", ["open", id]),
      menuItem("Save New Preset…", ["save-preset", id]),
      menuItem("Power On Selected Display", ["power-on", id]),
      menuItem("Power Off Selected Display…", ["power-off", id]),
      menuItem("Lunar Night Mode On", ["night", id, "on"]),
      menuItem("Lunar Night Mode Off", ["night", id, "off"]),
      menuItem("Refresh", ["refresh", id]),
      menuItem("Workflow Configuration…", ["configure", id]),
    ]);
  return {};
};
main()
  .then((action) => process.stdout.write(JSON.stringify(action || {}), () => process.exit(0)))
  .catch((error) => process.stdout.write(JSON.stringify(errorStatus(error)), () => process.exit(0)));
