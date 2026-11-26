import { profileCommand } from "../../../shared/ui-profile.ts";
await profileCommand(() => import("./env.ts"));
import { characterCount, splitText, combineParts } from "./chunks.ts";
import { clipboard, launchText } from "./input.ts";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { create, read, save, remember, type State } from "./state.ts";
import { translatePart, languageName, validLanguage } from "./api.ts";
import { bool, cacheDir } from "./env.ts";
import { components } from "../ui/window.ts";
import { launchInput, backVariables, performBack } from "./navigation.ts";
import {
  print,
  merge,
  vars,
  update,
  finish,
  copy,
  open,
  popup,
  menuItem,
  separator,
  errorStatus,
  type Action,
} from "./ui.ts";
const resultAction = (s: State): Action =>
  update(
    {
      resultText: {
        text: s.result?.text || s.job?.done.map((p) => p.text).join("") || "",
        colour: s.error ? "systemRedColor" : "labelColor",
      },
      sourceInfo: {
        text: `${characterCount(s.query)} / 50,000 characters${s.result ? ` · ${s.from === "auto" ? "Detected" : "Source"} ${languageName(s.result.from)}` : ""}`,
      },
      pronunciation: { text: s.result?.pronunciation || "", tooltip: s.result?.pronunciation || "" },
      statusLabel: {
        text: s.status,
        tooltip: s.status,
        colour: s.error ? "systemRedColor" : "secondaryLabelColor",
      },
      copyButton: { enabled: !!s.result },
    },
    true,
  );
const pulse = (s: State): Action => ({
  pulse: { src: "../bin/trns", args: ["translate", s.id, s.request], interval: 0, now: true },
});
const queue = (s: State, fresh = false): Action => {
  s.request = randomUUID();
  s.result = undefined;
  s.job = undefined;
  s.error = false;
  s.status = s.query.trim() ? "Translating…" : "Type text or choose Use Clipboard in Actions.";
  if (s.query.trim())
    try {
      s.job = { parts: splitText(s.query), done: [], fresh, failed: false };
    } catch (error) {
      s.error = true;
      s.status = error instanceof Error ? error.message : String(error);
    }
  save(s);
  return merge(resultAction(s), s.job ? pulse(s) : {});
};
const fetchResult = async (s: State, ticket: string): Promise<Action> => {
  if (ticket !== s.request || !s.job || s.job.failed) return {};
  const index = s.job.done.length;
  if (index >= s.job.parts.length) return {};
  await new Promise((resolve) => setTimeout(resolve, index ? 400 : 250));
  if (read(s.id).request !== ticket) return {};
  try {
    const result = await translatePart(s.job.parts[index]!, s.from, s.to, s.job.fresh),
      latest = read(s.id);
    if (latest.request !== ticket || !latest.job || latest.job.done.length !== index) return {};
    latest.job.done.push(result);
    latest.error = false;
    if (latest.job.done.length === latest.job.parts.length) {
      latest.result = combineParts(latest.job.done, latest.query, latest.to);
      latest.job = undefined;
      latest.status = `Google Translate · ${new Date(latest.result.fetched).toLocaleString()}`;
    } else
      latest.status = `Google Translate · ${latest.job.done.length} / ${latest.job.parts.length} parts complete`;
    save(latest);
    return merge(resultAction(latest), latest.job ? pulse(latest) : {});
  } catch (error) {
    const latest = read(s.id);
    if (latest.request !== ticket) return {};
    latest.result = undefined;
    latest.error = true;
    if (latest.job) latest.job.failed = true;
    latest.status = `${latest.job?.done.length || 0} / ${latest.job?.parts.length || 1} parts completed · ${error instanceof Error ? error.message : String(error)} · Continue in Actions`;
    save(latest);
    return resultAction(latest);
  }
};
const main = async (): Promise<Action | void> => {
  const [cmd = "", id = "", ...args] = process.argv.slice(2);
  if (cmd === "prepare-origin") return vars(backVariables("trns_out", process.env.trns_query));
  if (cmd === "post") {
    if (process.env.trns_out === "back") performBack(process.env.swiss_return);
    if (process.env.trns_out === "paste")
      execFileSync(
        "/usr/bin/osascript",
        ["-e", 'delay 0.15\ntell application "System Events" to keystroke "v" using command down'],
        { timeout: 5000 },
      );
    return;
  }
  if (cmd === "launch") {
    const origin = launchInput(process.env.trns_query);
    let query = origin.query,
      error = "";
    try {
      query = launchText(query, bool("use_clipboard", true));
    } catch {
      error = "Clipboard unavailable. Paste text in the original pane.";
    }
    const s = create(query, origin.returnTo),
      action = merge(
        vars({ trns_session: s.id, trns_query: "" }),
        update({ root: { components: components(s) } }, true),
        queue(s),
      );
    return error ? merge(action, update({ statusLabel: { text: error } })) : action;
  }
  const s = read(id);
  if (cmd === "back") return finish({ trns_out: "back", swiss_return: s.returnTo });
  if (cmd === "translate") return fetchResult(s, args[0] || "");
  if (cmd === "query") {
    s.query = args[0] || "";
    return queue(s);
  }
  if (cmd === "from" || cmd === "to") {
    const code = args[0] || "";
    if (!validLanguage(code, cmd === "from")) throw new Error("Choose a supported language.");
    s[cmd] = code;
    remember(s);
    return queue(s);
  }
  if (cmd === "continue") {
    if (!s.job || !s.job.failed) throw new Error("No interrupted translation to continue.");
    s.job.failed = false;
    s.error = false;
    s.request = randomUUID();
    s.status = `Continuing part ${s.job.done.length + 1} / ${s.job.parts.length}…`;
    save(s);
    return merge(resultAction(s), pulse(s));
  }
  if (cmd === "refresh") return queue(s, true);
  if (cmd === "clipboard") {
    s.query = clipboard();
    return merge(queue(s), update({ originalText: { text: s.query } }, true));
  }
  if (cmd === "swap") {
    if (!s.result) throw new Error("Translate some text before swapping languages.");
    if (!validLanguage(s.result.from))
      throw new Error("Choose a supported source language before swapping this detected language.");
    const previous = s.to;
    s.to = s.result.from;
    s.from = previous;
    s.query = s.result.text;
    remember(s);
    return merge(
      queue(s),
      update(
        { originalText: { text: s.query }, fromPicker: { selected: s.from }, toPicker: { selected: s.to } },
        true,
      ),
    );
  }
  if (cmd === "menu")
    return popup("actionsButton", [
      menuItem("Copy Translation", ["copy", id, "{value:originalText.text}"], "⌘↩"),
      menuItem("Paste Translation", ["paste", id, "{value:originalText.text}"]),
      menuItem("Copy Pronunciation", ["pronunciation", id, "{value:originalText.text}"]),
      menuItem("Copy Original Text", ["copy-original", id]),
      separator,
      menuItem("Use Clipboard", ["clipboard", id]),
      menuItem("Swap Languages", ["swap", id], "⌘L"),
      ...(s.job?.failed ? [menuItem("Continue Translation", ["continue", id])] : []),
      menuItem("Translate Again", ["refresh", id], "⌘R"),
      menuItem("Open in Google Translate", ["website", id]),
      menuItem("Language Defaults / Configuration", ["configure", id]),
      menuItem("Clear Cached Translations", ["clear-cache", id]),
    ]);
  if (cmd === "website") {
    const url = new URL("https://translate.google.com/");
    url.search = new URLSearchParams({ sl: s.from, tl: s.to, text: s.query, op: "translate" }).toString();
    return open(url.toString());
  }
  if (cmd === "configure") {
    execFileSync(
      "/usr/bin/osascript",
      [
        "-e",
        'tell application id "com.runningwithcrayons.Alfred" to reveal workflow "com.izsk.translate" configuration true',
      ],
      { timeout: 5000 },
    );
    return {};
  }
  if (cmd === "clear-cache") {
    for (const file of readdirSync(cacheDir()))
      if (/^translation-[a-f0-9]{64}\.json$/.test(file)) unlinkSync(join(cacheDir(), file));
    s.status = "Cached translations cleared.";
    save(s);
    return resultAction(s);
  }
  if (cmd === "copy-original") return copy(s.query);
  if (!s.result) throw new Error("Translate some text first.");
  if (args[0] !== undefined && args[0] !== s.result.original)
    throw new Error("Text changed. Wait for the updated translation.");
  if (cmd === "pronunciation") {
    if (!s.result.pronunciation) throw new Error("Google returned no pronunciation for this translation.");
    return copy(s.result.pronunciation);
  }
  if (cmd === "copy") return copy(s.result.text);
  if (cmd === "paste") return merge(copy(s.result.text), finish({ trns_out: "paste" }));
  throw new Error("Unknown Translate action.");
};
try {
  const action = await main();
  if (action) print(action);
} catch (error) {
  print(errorStatus(error));
}
