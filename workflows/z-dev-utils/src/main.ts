import { profileCommand, profileAction } from "../../../shared/ui-profile.ts";
await profileCommand(() => import("./env.ts"));
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { str, bool } from "./env.ts";
import { create, read, save, type State } from "./state.ts";
import { tools, transform } from "./transforms.ts";
import { components, run, copyOutput } from "../ui/window.ts";
import { launchInput, backVariables, performBack } from "./navigation.ts";
import { merge, vars, update, finish, popup, errorStatus, copy, open, type Action } from "./ui.ts";
const clipboard = (): string => {
  const text = execFileSync("/usr/bin/pbpaste", [], { encoding: "utf8", timeout: 3000, maxBuffer: 120000 });
  if (text.length > 50000) throw new Error("Clipboard exceeds 50,000 characters.");
  return text;
};
const result = (s: State, text: string): Action => {
  try {
    const output = transform(s.selected, text);
    return update(
      {
        output: { text: output },
        statusLabel: {
          text: `${text.length} → ${output.length} characters · Local`,
          colour: "secondaryLabelColor",
        },
      },
      true,
    );
  } catch (e) {
    return update(
      {
        output: { text: "" },
        statusLabel: { text: e instanceof Error ? e.message : "Invalid input", colour: "systemRedColor" },
      },
      true,
    );
  }
};
const render = (s: State): Action => {
  const rows = tools.filter(([, title]) => title.toLowerCase().includes(s.query.toLowerCase()));
  save(s);
  return update(
    {
      items: {
        data: {
          src: rows.map(([id, title]) => ({
            uid: id,
            "rowTitle.text": title,
            "rowIcon.image.type": "symbol",
            "rowIcon.image.src": "curlybraces",
          })),
        },
        select: rows.some(([id]) => id === s.selected) ? s.selected : "",
        placeholder: "No matching transformations.",
      },
    },
    true,
  );
};
const main = async (): Promise<Action | void> => {
  const [cmd = "", id = "", value = ""] = process.argv.slice(2);
  if (cmd === "prepare-origin")
    return merge(
      vars(backVariables("devutils_out", process.env.devutils_query)),
      profileAction({ str, bool }),
    );
  if (cmd === "post") {
    if (process.env.devutils_out === "back") performBack(process.env.dev_return);
    if (process.env.devutils_out === "paste")
      execFileSync(
        "/usr/bin/osascript",
        ["-e", 'tell application "System Events" to keystroke "v" using command down'],
        { timeout: 5000 },
      );
    return;
  }
  if (cmd === "launch") {
    const origin = launchInput(process.env.devutils_query),
      s = create(origin.returnTo),
      text = origin.query || (bool("use_clipboard", true) ? clipboard() : "");
    if (text.length > 50000 || Buffer.byteLength(text) > 120000)
      throw new Error("Input exceeds 50,000 characters / 120 KB.");
    return merge(
      vars({ devutils_session: s.id, devutils_text: text }),
      update({ root: { components: components(text) } }, true),
      { pulse: { src: "../bin/devutils", args: ["populate", s.id], interval: 0, now: true } },
    );
  }
  const s = read(id),
    text = process.env.devutils_text || "";
  if (cmd === "populate" || cmd === "refresh") return merge(render(s), result(s, text));
  if (cmd === "query") {
    s.query = value;
    return render(s);
  }
  if (cmd === "select") {
    if (!tools.some(([key]) => key === value)) return {};
    s.selected = value;
    save(s);
    return result(s, text);
  }
  if (cmd === "transform") return result(s, text);
  if (cmd === "back") return finish({ devutils_out: "back", dev_return: s.returnTo });
  if (cmd === "clipboard" || cmd === "clear" || cmd === "reuse") {
    const input = cmd === "clipboard" ? clipboard() : cmd === "clear" ? "" : text;
    return merge(vars({ devutils_text: input }), update({ input: { text: input } }, true), result(s, input));
  }
  if (cmd === "open" || cmd === "paste") {
    const output = transform(s.selected, text);
    return merge(
      copy(output),
      cmd === "paste"
        ? finish({ devutils_out: "paste" })
        : update({ statusLabel: { text: "Copied output", colour: "secondaryLabelColor" } }, true),
    );
  }
  if (cmd === "app") {
    let installed = ["/Applications/DevUtils.app", "/Applications/Paid/DevUtils.app"].some(existsSync);
    if (!installed)
      try {
        installed = execFileSync("/usr/bin/mdfind", ["kMDItemCFBundleIdentifier == 'tonyapp.devutils'"], {
          encoding: "utf8",
          timeout: 3000,
        })
          .split("\n")
          .filter(Boolean)
          .some(existsSync);
      } catch {}
    if (!installed) throw new Error("DevUtils app is not installed. Local transformations remain available.");
    return merge(copy(text), open("devutils://auto?clipboard"));
  }
  if (cmd === "website") return open("https://devutils.com");
  if (cmd === "configure") {
    execFileSync(
      "/usr/bin/osascript",
      [
        "-e",
        'tell application id "com.runningwithcrayons.Alfred" to reveal workflow "com.izsk.dev-utils" configuration true',
      ],
      { timeout: 5000 },
    );
    return {};
  }
  if (cmd === "menu")
    return popup(
      "actionsButton",
      [
        ["Copy Output", "open"],
        ["Paste Output", "paste"],
        ["Use Output as Input", "reuse"],
        ["Read Clipboard", "clipboard"],
        ["Clear Input", "clear"],
        ["Open Input in DevUtils App…", "app"],
        ["DevUtils Website", "website"],
        ["Workflow Configuration…", "configure"],
      ].map(([title, command]) => ({
        text: title,
        action:
          command === "open"
            ? copyOutput()
            : command === "paste"
              ? copyOutput(true)
              : command === "reuse"
                ? { ...run(command), variables: { devutils_text: "{value:output.text}" } }
                : run(command!),
      })),
    );
  return {};
};
main()
  .then((a) => process.stdout.write(JSON.stringify(a || {})))
  .catch((e) => process.stdout.write(JSON.stringify(errorStatus(e))));
