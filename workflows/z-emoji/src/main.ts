import { execFileSync } from "node:child_process";
import { profileAction } from "../../../shared/ui-profile.ts";
import { str, bool } from "./env.ts";
import { create, read, save, type State } from "./state.ts";
import { search, find, groups, preferences, favorite, record, variants } from "./emoji.ts";
import { components } from "../ui/window.ts";
import { launchInput, backVariables, performBack } from "./navigation.ts";
import { merge, vars, update, finish, popup, menuItem, copy, open, errorStatus, type Action } from "./ui.ts";
const render = (s: State): Action => {
  const values = search(s.query, s.category, s.parent),
    fav = preferences().favorites;
  if (!values.some((e) => e.id === s.selected)) s.selected = values[0]?.id || "";
  save(s);
  return update(
    {
      items: {
        data: {
          src: values.map((e) => ({
            uid: e.id,
            "emojiGlyph.text": e.emoji,
            "rowTitle.text": `${fav.includes(e.id) ? "★ " : ""}${e.name}`,
            "rowDescription.text": `${e.shortcode} · ${e.group}`,
          })),
        },
        select: s.selected,
        placeholder: "No matching emoji",
      },
      statusLabel: { text: `${values.length}${values.length === 500 ? "+" : ""} emoji · Unicode 17.0` },
      primary: { text: `${str("primary_action", "copy") === "paste" ? "Paste" : "Copy"}  ↩` },
    },
    true,
  );
};
const main = async (): Promise<Action | void> => {
  const [cmd = "", id = "", ...args] = process.argv.slice(2),
    value = args[0] || "";
  if (cmd === "prepare-origin")
    return merge(vars(backVariables("emoji_out", process.env.emoji_query)), profileAction({ str, bool }));
  if (cmd === "post") {
    if (process.env.emoji_out === "back") performBack(process.env.swiss_return);
    if (process.env.emoji_out === "paste")
      execFileSync(
        "/usr/bin/osascript",
        ["-e", 'tell application "System Events" to keystroke "v" using command down'],
        { timeout: 5000 },
      );
    return;
  }
  if (cmd === "launch") {
    const origin = launchInput(process.env.emoji_query),
      s = create(origin.query, origin.returnTo);
    return merge(vars({ emoji_session: s.id }), update({ root: { components: components(s.query) } }, true), {
      pulse: { src: "../bin/emoji", args: ["populate", s.id], interval: 0, now: true },
    });
  }
  const s = read(id);
  if (cmd === "populate" || cmd === "refresh") return render(s);
  if (cmd === "query") {
    s.query = value;
    save(s);
    return render(s);
  }
  if (cmd === "select") {
    s.selected = value;
    save(s);
    return {};
  }
  if (cmd === "category") {
    if (!["All", "Favorites", "Recent", ...groups].includes(value)) return {};
    s.category = value;
    s.parent = "";
    s.history = [];
    save(s);
    return render(s);
  }
  if (cmd === "back") {
    const prior = s.history.pop();
    if (prior) {
      Object.assign(s, prior);
      save(s);
      return merge(update({ query: { text: s.query }, category: { selected: s.category } }, true), render(s));
    }
    return finish({ emoji_out: "back", swiss_return: s.returnTo });
  }
  const selected = value || s.selected;
  if (cmd === "favorite") {
    favorite(selected);
    return render(s);
  }
  if (cmd === "variants") {
    const entry = find(selected);
    if (variants(entry).length < 2) return {};
    s.history.push({ query: s.query, category: s.category, selected: s.selected, parent: s.parent });
    s.parent = entry.id;
    s.query = "";
    save(s);
    return merge(update({ query: { text: "" } }, true), render(s));
  }
  if (cmd === "open" || cmd === "copy" || cmd === "paste") {
    const entry = find(selected);
    record(entry.id);
    const paste = cmd === "paste" || (cmd === "open" && str("primary_action", "copy") === "paste");
    return paste
      ? merge(copy(entry.emoji), finish({ emoji_out: "paste" }))
      : merge(copy(entry.emoji), update({ statusLabel: { text: `Copied ${entry.emoji}` } }, true));
  }
  if (cmd === "shortcode") return copy(find(selected).shortcode);
  if (cmd === "website") return open(`https://emojipedia.org/${encodeURIComponent(find(selected).emoji)}`);
  if (cmd === "configure") {
    execFileSync(
      "/usr/bin/osascript",
      [
        "-e",
        'tell application id "com.runningwithcrayons.Alfred" to reveal workflow "com.izsk.emoji" configuration true',
      ],
      { timeout: 5000 },
    );
    return {};
  }
  if (cmd === "menu")
    return popup("actionsButton", [
      menuItem("Copy Emoji", ["copy", id, selected]),
      menuItem("Paste Emoji", ["paste", id, selected]),
      menuItem(preferences().favorites.includes(selected) ? "Remove Favorite" : "Add Favorite", [
        "favorite",
        id,
        selected,
      ]),
      ...(selected && variants(find(selected)).length > 1
        ? [menuItem("Skin Tone / Variants…", ["variants", id, selected])]
        : []),
      menuItem("Copy Descriptive Shortcode", ["shortcode", id, selected]),
      menuItem("View on Emojipedia", ["website", id, selected]),
      menuItem("Workflow Configuration…", ["configure", id]),
    ]);
  return {};
};
main()
  .then((action) => process.stdout.write(JSON.stringify(action || {}), () => process.exit(0)))
  .catch((error) => process.stdout.write(JSON.stringify(errorStatus(error)), () => process.exit(0)));
