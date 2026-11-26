import { profileCommand } from "../../../shared/ui-profile.ts";
await profileCommand(() => import("./env.ts"));
import { create, read, save, type State } from "./state.ts";
import { tools, installed, available, envelope } from "./tools.ts";
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
const rows = (s: State) =>
  tools
    .filter((t) =>
      `${t.name} ${t.description} ${t.keyword}`.toLowerCase().includes(s.query.toLowerCase().trim()),
    )
    .map((t) => ({
      uid: t.id,
      "rowFlag.image.type": "file",
      "rowFlag.image.src": `../icons/${t.id}.png`,
      "rowTitle.text": t.name,
      "rowDescription.text": `${available(t, s.installed) ? t.description : "Install/update this independent workflow first"} · ${t.keyword}`,
    }));
const populate = (s: State): Action => {
  const data = rows(s);
  return update({
    items: {
      data: { src: data },
      select: data.some((t) => t.uid === s.selected) ? s.selected : data[0]?.uid || "",
    },
  });
};
const screen = (s: State): Action =>
  merge(vars({ dev_session: s.id }), update({ root: { components: components(s) } }, true), {
    pulse: { src: "../bin/dev", args: ["populate", s.id], interval: 0, now: true },
  });
const main = async (): Promise<Action | void> => {
  const [cmd = "", id = "", ...args] = process.argv.slice(2);
  if (cmd === "post") {
    if (process.env.dev_out === "back") {
      await osascript('tell application id "com.runningwithcrayons.Alfred" to search (item 1 of argv)', "");
      return;
    }
    if (process.env.dev_out === "launch") {
      const s = read(process.env.dev_session || ""),
        tool = tools.find((t) => t.id === process.env.dev_tool);
      if (!tool) throw new Error("Unknown Dev tool.");
      if (!available(tool, installed())) throw new Error("Install or update the selected tool first.");
      await osascript(
        'tell application id "com.runningwithcrayons.Alfred" to run trigger (item 1 of argv) in workflow (item 2 of argv) with argument (item 3 of argv)',
        tool.trigger,
        tool.bundle,
        envelope(s.id),
      );
    }
    return;
  }
  if (cmd === "launch") {
    const query = process.env.dev_query || "",
      s = query.startsWith("resume:") ? read(query.slice(7)) : create(query, installed());
    return screen(s);
  }
  if (cmd === "initial-back") return finish({ dev_out: "back" });
  const s = read(id),
    selected = args[0] || s.selected;
  if (cmd === "back") return finish({ dev_out: "back" });
  if (cmd === "populate") return populate(s);
  if (cmd === "query") {
    s.query = args[0] || "";
    save(s);
    return populate(s);
  }
  if (cmd === "select") {
    s.selected = selected;
    save(s);
    return {};
  }
  if (cmd === "refresh") {
    s.installed = installed();
    save(s);
    return populate(s);
  }
  if (cmd === "open") {
    const tool = tools.find((t) => t.id === selected);
    if (!tool) throw new Error("Select a tool.");
    if (!available(tool, s.installed))
      throw new Error(
        "Install/update this workflow first. Actions → Download Workflows opens the repository.",
      );
    s.selected = tool.id;
    save(s);
    return finish({ dev_out: "launch", dev_tool: tool.id, dev_session: s.id });
  }
  if (cmd === "copy-keyword") {
    const tool = tools.find((t) => t.id === selected);
    if (!tool) throw new Error("Select a tool.");
    return copy(tool.keyword);
  }
  if (cmd === "website") return open("https://github.com/sk-izsk/z-alfred-workflow#workflows");
  if (cmd === "menu")
    return popup("actionsButton", [
      menuItem("Open Tool", ["open", id, selected], "↩"),
      menuItem("Copy Default Shortcut", ["copy-keyword", id, selected]),
      menuItem("Refresh Installed Tools", ["refresh", id], "⌘R"),
      menuItem("Download Workflows", ["website", id]),
    ]);
  throw new Error("Unknown Dev command.");
};
try {
  const result = await main();
  if (result) print(result);
} catch (error) {
  print(errorStatus(error));
}
