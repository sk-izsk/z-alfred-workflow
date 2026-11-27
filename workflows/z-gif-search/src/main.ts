import { freshSelection } from "../../../shared/dashboard.ts";
import { profileCommand, profileAction } from "../../../shared/ui-profile.ts";
await profileCommand(() => import("./env.ts"));
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, writeFileSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { str, bool, cacheDir } from "./env.ts";
import {
  search,
  thumbnails,
  preferences,
  savePreferences,
  remember,
  providers,
  validURL,
  bounded,
  type Gif,
  type Provider,
  giphyKey,
  removeGiphyKey,
  saveGiphyKey,
} from "./gifs.ts";
import { create, read, save, type State } from "./state.ts";
import { components } from "../ui/window.ts";
import { launchInput, backVariables, performBack } from "./navigation.ts";
import {
  merge,
  vars,
  update,
  finish,
  popup,
  menuItem,
  copy,
  open,
  errorStatus,
  sheet,
  type Action,
} from "./ui.ts";
const render = (s: State): Action => {
  if (!s.rows.some((e) => e.id === s.selected)) s.selected = s.rows[0]?.id || "";
  save(s);
  return update(
    {
      items: {
        data: {
          src: s.rows.map((e) => ({
            uid: e.id,
            "rowIcon.image.type": "file",
            "rowIcon.image.src": e.previewPath || "../icon.png",
            "rowTitle.text": e.title,
            "rowTitle.tooltip": e.title,
            "rowDescription.text": e.provider,
          })),
        },
        select: s.selected,
        placeholder: "No GIFs. Try another search/provider, or add favorites from Actions.",
      },
      statusLabel: {
        text: `${s.rows.length} GIFs · ${s.fetched ? new Date(s.fetched).toLocaleTimeString() : "Local"} · ${s.more ? "More in Actions" : s.source}`,
      },
      primary: {
        text: str("primary_action", "copyfile") === "copyfile" ? "Copy GIF  ↩" : "Copy  ↩",
      },
    },
    true,
  );
};
const mount = (s: State): Action =>
  merge(update({ root: { components: components(s, preferences().layout) } }, true), {
    pulse: { src: "../bin/gifsearch", args: ["populate", s.id], interval: 0, now: true },
  });
const saveKey = (id: string): Action => ({
  type: "script",
  src: "../bin/gifsearch",
  args: ["key-save", id],
  variables: { gifsearch_key: "{value:keyField.text}" },
});
const load = async (s: State, fresh = false, more = false): Promise<Action> => {
  const request = randomUUID();
  s.request = request;
  save(s);
  if (["favorites", "recent"].includes(s.source)) {
    const p = preferences();
    s.rows = (s.source === "favorites" ? p.favorites : p.recent).filter((e) =>
      e.title.toLowerCase().includes(s.query.toLowerCase()),
    );
    s.more = false;
    s.fetched = 0;
    return render(s);
  }
  const result = await search(s.query, s.source as Provider, more ? s.page + 1 : 0, fresh);
  await thumbnails(result.rows);
  if (read(s.id).request !== request) return {};
  s.page = more ? s.page + 1 : 0;
  s.rows = more
    ? [...s.rows, ...result.rows.filter((e) => !s.rows.some((old) => old.id === e.id))]
    : result.rows;
  s.fetched = result.at;
  s.more = result.more;
  return render(s);
};
const download = async (e: Gif): Promise<string> => {
  let url = validURL(e.url);
  if (!url) throw new Error("Invalid GIF URL.");
  const file = join(cacheDir(), `${createHash("sha256").update(url).digest("hex")}.gif`);
  if (existsSync(file)) return file;
  let response: Response | undefined;
  for (let i = 0; i < 4; i++) {
    response = await fetch(url, { signal: AbortSignal.timeout(20000), redirect: "manual" });
    if (response.status < 300 || response.status >= 400) break;
    url = validURL(new URL(response.headers.get("location") || "", url).href);
    if (!url) throw new Error("Untrusted GIF redirect.");
  }
  const bytes = await bounded(response!, 30e6);
  const magic = new TextDecoder().decode(bytes.slice(0, 6));
  if (!["GIF87a", "GIF89a"].includes(magic)) throw new Error("Provider did not return a GIF file.");
  writeFileSync(file, bytes, { mode: 0o600 });
  return file;
};
const main = async (): Promise<Action | void> => {
  const [cmd = "", id = "", value = ""] = process.argv.slice(2);
  if (cmd === "prepare-origin")
    return merge(
      vars(backVariables("gifsearch_out", process.env.gifsearch_query)),
      profileAction({ str, bool }),
    );
  if (cmd === "post") {
    if (process.env.gifsearch_out === "back") performBack(process.env.swiss_return);
    if (process.env.gifsearch_out === "paste")
      execFileSync(
        "/usr/bin/osascript",
        ["-e", 'tell application "System Events" to keystroke "v" using command down'],
        { timeout: 5000 },
      );
    return;
  }
  if (cmd === "launch") {
    const origin = launchInput(process.env.gifsearch_query),
      s = create(origin.query, origin.returnTo);
    return merge(vars({ gifsearch_session: s.id }), mount(s));
  }
  const s = read(id);
  if (cmd === "populate") return s.rows.length ? render(s) : load(s);
  if (cmd === "refresh") return load(s, true);
  if (cmd === "query") {
    s.query = value;
    s.selected = "";
    s.page = 0;
    return load(s);
  }
  if (cmd === "source") {
    if (![...providers, "favorites", "recent"].includes(value)) return {};
    s.source = value;
    s.rows = [];
    s.page = 0;
    return load(s);
  }
  if (cmd === "layout") {
    if (!["list", "grid"].includes(value)) return {};
    const p = preferences();
    p.layout = value as "list" | "grid";
    savePreferences(p);
    save(s);
    return mount(s);
  }
  if (cmd === "select") {
    if (!freshSelection(s)) return {};
    s.selected = value;
    save(s);
    return {};
  }
  if (cmd === "back") return finish({ gifsearch_out: "back", swiss_return: s.returnTo });
  if (cmd === "more") return s.more ? load(s, false, true) : {};
  if (cmd === "configure") {
    execFileSync(
      "/usr/bin/osascript",
      [
        "-e",
        'tell application id "com.runningwithcrayons.Alfred" to reveal workflow "com.izsk.gif-search" configuration true',
      ],
      { timeout: 5000 },
    );
    return {};
  }
  if (cmd === "key")
    // The key travels as a script environment variable (gifsearch_key), never in argv.
    return sheet("giphyKey", {
      type: "view",
      layout: "inline",
      direction: "vertical",
      padding: 20,
      spacing: 10,
      components: [
        { type: "label", text: "GIPHY API key", font: { size: 15, weight: "semibold" } },
        {
          id: "keyNote",
          type: "label",
          text: "For GIPHY direct. Kept in your macOS Keychain, not in Alfred’s preferences.",
          colour: "secondaryLabelColor",
          constraints: { size: { width: 360 } },
        },
        {
          id: "keyField",
          type: "passwordfield",
          placeholder: "GIPHY API key",
          focus: true,
          constraints: { size: { width: 360 } },
          events: [{ triggers: "actioned", action: saveKey(id) }],
        },
        {
          id: "saveKey",
          type: "button",
          text: "Save  ↩",
          shortcut: "↩",
          constraints: { region: "bottom" },
          events: [{ triggers: "actioned", action: saveKey(id) }],
        },
      ],
    });
  if (cmd === "key-save") {
    try {
      saveGiphyKey(process.env.gifsearch_key ?? "");
    } catch (error) {
      return update({
        keyNote: {
          text: error instanceof Error ? error.message : String(error),
          colour: "systemRedColor",
        },
      });
    }
    return merge({ sheet: { close: "giphyKey" } }, await load(s, true));
  }
  if (cmd === "key-remove") {
    removeGiphyKey();
    return load(s, true);
  }
  const e = s.rows.find((x) => x.id === (value || s.selected));
  if (cmd === "menu")
    return popup("actionsButton", [
      ...(e
        ? [
            menuItem("Copy GIF", ["copyfile", id, e.id]),
            menuItem("Copy GIF Link", ["link", id, e.id]),
            menuItem("Copy Markdown", ["markdown", id, e.id]),
            menuItem("Paste Markdown", ["paste", id, e.id]),
            menuItem(
              preferences().favorites.some((x) => x.id === e.id)
                ? "Remove Favorite"
                : "Add Favorite",
              ["favorite", id, e.id],
            ),
            menuItem("View GIF Details", ["details", id, e.id]),
            menuItem("Copy Page Link", ["page", id, e.id]),
            menuItem("Open in Browser", ["website", id, e.id]),
            menuItem("Download GIF", ["download", id, e.id]),
          ]
        : []),
      ...(s.more ? [menuItem("Load More", ["more", id])] : []),
      menuItem("Refresh", ["refresh", id]),
      menuItem("Set GIPHY API Key…", ["key", id]),
      ...(giphyKey() ? [menuItem("Remove GIPHY API Key", ["key-remove", id])] : []),
      menuItem("Workflow Configuration…", ["configure", id]),
    ]);
  if (!e) throw new Error("Select a GIF first.");
  const action = cmd === "open" ? str("primary_action", "copyfile") : cmd;
  if (action === "favorite") {
    remember(e, true);
    return ["favorites", "recent"].includes(s.source)
      ? load(s)
      : update({ statusLabel: { text: "Favorites updated" } }, true);
  }
  if (action === "website") return open(e.page);
  if (action === "details") {
    const escape = (v: string) => v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    return sheet("gifDetails", {
      type: "view",
      layout: "border",
      padding: 16,
      constraints: { size: { width: 650, height: 400 } },
      components: [
        {
          type: "label",
          text: e.title,
          font: { size: 17, weight: "medium" },
          linebreak: "truncatetail",
          constraints: { region: "top" },
        },
        {
          type: "webkitview",
          constraints: { region: "centre", size: { height: 290 } },
          text: `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https:; style-src 'unsafe-inline'"><style>body{margin:0;background:transparent;display:grid;place-items:center;height:100vh}img{max-width:100%;max-height:100vh}</style><img src="${escape(e.url)}">`,
        },
        {
          type: "label",
          text: `${e.provider} · ${e.page}`,
          font: { size: 10 },
          linebreak: "truncatetail",
          constraints: { region: "bottom" },
        },
      ],
    });
  }
  if (["copyfile", "download"].includes(action)) {
    const file = await download(e);
    remember(e);
    if (action === "download") {
      const dest = join(homedir(), "Downloads", `gif-${randomUUID()}.gif`);
      copyFileSync(file, dest);
      return merge(
        { open: { type: "file", src: dest } },
        update({ statusLabel: { text: "Saved to Downloads" } }, true),
      );
    }
    return merge(
      { copy: { type: "file", src: [file] } },
      update({ statusLabel: { text: "Copied GIF file" } }, true),
    );
  }
  if (["link", "markdown", "page", "paste"].includes(action)) {
    remember(e);
    const markdown = `![${e.title.replace(/[[\]\\\n]/g, " ")}](${e.url})`;
    return merge(
      copy(action === "link" ? e.url : action === "page" ? e.page : markdown),
      action === "paste"
        ? finish({ gifsearch_out: "paste" })
        : update({ statusLabel: { text: "Copied" } }, true),
    );
  }
  return {};
};
main()
  .then((action) => process.stdout.write(JSON.stringify(action || {})))
  .catch((error) => process.stdout.write(JSON.stringify(errorStatus(error))));
