import { freshSelection } from "../../../shared/dashboard.ts";
import { profileAction, profileCommand } from "../../../shared/ui-profile.ts";
await profileCommand(() => import("./env.ts"));
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  CATEGORIES,
  getDaily,
  getProblem,
  getProfile,
  randomProblem,
  ratings,
  searchProblems,
  TOPICS,
  type Problem,
} from "./api.ts";
import { bool, str } from "./env.ts";
import { problemMarkdown } from "./markdown.ts";
import { backVariables, launchInput, performBack } from "./navigation.ts";
import { previewScreen, problemRow, profileRows, profileScreen, run, searchScreen } from "./screens.ts";
import { create, prefs, read, save, savePrefs, top, type Screen, type State } from "./state.ts";
import { copy, errorStatus, finish, merge, open, popup, sheet, update, vars, type Action } from "./ui.ts";

const URL_BASE = "https://leetcode.com";
const showStats = () => bool("show_stats", true);
const showRatings = () => bool("show_ratings", true);
const problemUrl = (slug: string) => `${URL_BASE}/problems/${slug}/`;
const profileUrl = (name: string) => `${URL_BASE}/u/${encodeURIComponent(name)}/`;
/** Ratings come from a day-long cache; `ratings()` refreshes it when stale. */
const cachedRatings = async () => (showRatings() ? await ratings() : undefined);

const listRows = async (s: State) => {
  const r = await cachedRatings();
  const rows = s.rows.map((p) => problemRow(p, r ? (r[p.slug] ?? null) : undefined, showStats()));
  if (s.hasMore)
    rows.push({
      ...problemRow({ id: "", title: "", slug: "more", difficulty: "Easy", paid: false }),
      "rowTitle.text": "Load more problems…",
      "rowLevel.text": "",
      "rowLevelBox.background": null,
    });
  return rows;
};

const previewText = async (s: State, screen: Extract<Screen, { kind: "preview" }>): Promise<string> => {
  if (!s.problem || s.problem.slug !== screen.slug)
    return s.status.startsWith("Couldn") ? `# ${s.status}` : "Loading…";
  const r = await cachedRatings();
  return problemMarkdown(s.problem, {
    date: screen.date,
    stats: showStats(),
    topics: bool("show_topics", false),
    rating: r ? (r[s.problem.slug] ?? null) : undefined,
  });
};

/** Whole screen: used when the screen changes. Typing only updates the list (keeps the cursor). */
const render = async (s: State): Promise<Action> => {
  save(s);
  const screen = top(s);
  const components =
    screen.kind === "search"
      ? searchScreen(s.query, s.category, await listRows(s), s.selected, s.status)
      : screen.kind === "preview"
        ? previewScreen(await previewText(s, screen), s.status)
        : profileScreen(s.profile ? profileRows(s.profile) : [], s.selected, s.status);
  return update({ root: { components } }, true);
};
const renderList = async (s: State): Promise<Action> => {
  save(s);
  return update(
    { items: { data: { src: await listRows(s) }, select: s.selected }, statusLabel: { text: s.status } },
    true,
  );
};

const pulse = (s: State): Action => ({
  pulse: { src: "../bin/leetcode", args: ["load", s.id, s.request], interval: 0, now: true },
});
const push = async (s: State, screen: Screen, status = "Loading…"): Promise<Action> => {
  s.stack.push(screen);
  s.request = randomUUID();
  s.status = status;
  return merge(await render(s), pulse(s));
};

/** Network work for the top screen; a newer request makes this one return nothing. */
const load = async (s: State, ticket: string): Promise<Action> => {
  const screen = top(s);
  const fresh = () => {
    const latest = read(s.id);
    return latest.request === ticket ? latest : undefined;
  };
  try {
    if (screen.kind === "search") {
      const [page] = await Promise.all([searchProblems(s.query, s.category, s.page), cachedRatings()]);
      const latest = fresh();
      if (!latest) return {};
      latest.rows = latest.page ? [...latest.rows, ...page.rows] : page.rows;
      latest.hasMore = page.hasMore;
      const category = CATEGORIES.find(([v]) => v === latest.category)?.[1] ?? "All";
      latest.status = `${category} · ${latest.rows.length}${page.hasMore ? "+" : ""} problems`;
      if (!latest.rows.some((r) => r.slug === latest.selected)) latest.selected = latest.rows[0]?.slug ?? "";
      return renderList(latest);
    }
    if (screen.kind === "preview") {
      let problem: Problem;
      let date: string | undefined;
      if (screen.random && !screen.slug) problem = await getProblem((await randomProblem(s.filters)).slug);
      else if (screen.date === "today") ({ problem, date } = await getDaily());
      else problem = await getProblem(screen.slug);
      const latest = fresh();
      if (!latest) return {};
      const current = top(latest);
      if (current.kind === "preview") {
        current.slug = problem.slug;
        if (date) current.date = date;
      }
      latest.problem = problem;
      latest.status = screen.random
        ? "Random problem · ⌘R picks another"
        : screen.date
          ? "Daily Challenge"
          : "";
      return render(latest);
    }
    const profile = await getProfile(screen.username);
    const latest = fresh();
    if (!latest) return {};
    latest.profile = profile;
    latest.status = `${profile.username} · ${profile.recent.length} recent accepted`;
    return render(latest);
  } catch (error) {
    const latest = fresh();
    if (!latest) return {};
    latest.status = `Couldn’t load: ${error instanceof Error ? error.message : String(error)}`;
    return render(latest);
  }
};

const back = async (s: State): Promise<Action> => {
  s.stack.pop();
  if (!s.stack.length) return finish({ leetcode_out: "back", dev_return: s.returnTo });
  // The search list is kept, so going back needs no network.
  if (top(s).kind === "search") s.status = `${s.rows.length} problems`;
  return render(s);
};

/** A picker value from the sheet, or "" when it isn't one of the offered options. */
const valid = (v: string, list: [string, string][]) => (list.some(([x]) => x === v) ? v : "");
const preferredLanguage = () => str("language", "python3").replace(/^go$/, "golang");
const snippetsFirst = (p: Problem): Problem["snippets"] => {
  const preferred = preferredLanguage();
  return p.snippets.toSorted((a, b) =>
    a.langSlug === preferred ? -1 : b.langSlug === preferred ? 1 : a.lang.localeCompare(b.lang),
  );
};

const item = (text: string, cmd: string, args: string[] = [], hint = "") => ({
  text: hint ? `${text}   ${hint}` : text,
  action: run(cmd, args, false),
});
const menu = (s: State, uid: string): Action => {
  const screen = top(s);
  const common = [
    { type: "separator" },
    item("Daily Challenge", "daily"),
    item("Random Problem…", "random"),
    item("User Profile…", "profile"),
    item("Refresh", "refresh", [], "⌘R"),
    item("Workflow Configuration…", "configure"),
  ];
  if (screen.kind === "preview" && s.problem) {
    const p = s.problem;
    const snippets = snippetsFirst(p);
    return popup("actionsButton", [
      item("Open in Browser", "open", [], "↩"),
      item("Copy Link to Clipboard", "copy-link", [p.slug]),
      ...(p.paid ? [] : [item("Copy Problem to Clipboard", "copy-problem")]),
      ...(snippets.length
        ? [
            {
              text: "Copy Code Template",
              submenu: snippets.map((x) =>
                item(`${x.langSlug === preferredLanguage() ? "⭐ " : ""}${x.lang}`, "copy-template", [
                  x.langSlug,
                ]),
              ),
            },
          ]
        : []),
      ...(screen.random ? [item("Pick Another Problem", "another", [], "⌘R")] : []),
      ...common,
    ]);
  }
  const slug = uid && !uid.includes(":") && uid !== "more" ? uid : "";
  return popup("actionsButton", [
    ...(slug
      ? [
          item("Preview Problem", "open", [slug], "↩"),
          item("Open in Browser", "browser", [slug]),
          item("Copy Link to Clipboard", "copy-link", [slug]),
        ]
      : []),
    ...(screen.kind === "profile" && s.profile
      ? [item("Open Profile in Browser", "browser", [`profile:${s.profile.username}`])]
      : []),
    ...(screen.kind === "search" && s.hasMore ? [item("Load More Problems", "open", ["more"])] : []),
    ...common,
  ]);
};

const formSheet = (id: string, title: string, fields: object[], submit: object, button: string): Action =>
  sheet(id, {
    type: "view",
    layout: "inline",
    direction: "vertical",
    padding: 20,
    spacing: 10,
    components: [
      { type: "label", text: title, font: { size: 15, weight: "semibold" } },
      ...fields,
      {
        id: `${id}Submit`,
        type: "button",
        text: `${button}  ↩`,
        constraints: { region: "bottom" },
        events: [{ triggers: "actioned", action: submit }],
      },
    ],
  });
const picker = (id: string, selected: string, items: [string, string][]) => ({
  id,
  type: "picker",
  selected,
  items: items.map(([value, text]) => ({ value, text })),
  constraints: { size: { width: 300 } },
});

/** The username travels as a script environment variable (leetcode_user), never in argv. */
const submitUser = { ...run("profile-user", [], false), variables: { leetcode_user: "{value:uName.text}" } };
const profileSheet = (): Action =>
  formSheet(
    "userSheet",
    "LeetCode profile",
    [
      {
        id: "uName",
        type: "textfield",
        text: str("username") || prefs().username,
        placeholder: "Username",
        focus: true,
        constraints: { size: { width: 300 } },
        events: [{ triggers: "actioned", action: submitUser }],
      },
      {
        id: "uNote",
        type: "label",
        text: "Public profile data only; no sign-in.",
        colour: "secondaryLabelColor",
      },
    ],
    submitUser,
    "Show Profile",
  );

const main = async (): Promise<Action> => {
  const [cmd = "", id = "", value = ""] = process.argv.slice(2);
  if (cmd === "prepare-origin")
    return merge(
      vars(backVariables("leetcode_out", process.env.leetcode_query)),
      profileAction({ str, bool }),
    );
  if (cmd === "post") {
    if (process.env.leetcode_out === "back") performBack(process.env.dev_return);
    return {};
  }
  if (cmd === "launch") {
    const origin = launchInput(process.env.leetcode_query || ""),
      q = origin.query.trim();
    // Keyword variants arrive as daily:, random: or user:<name>; anything else is a search.
    const asksUser = q.startsWith("user:");
    const user = asksUser ? q.slice(5).trim() || str("username") || prefs().username : "";
    const first: Screen =
      q === "daily:"
        ? { kind: "preview", slug: "", date: "today" }
        : q === "random:"
          ? { kind: "preview", slug: "", random: true }
          : user
            ? { kind: "profile", username: user }
            : { kind: "search" };
    const s = create(origin.returnTo, first, first.kind === "search" && !asksUser ? q : "");
    if (user) savePrefs({ username: user });
    const action = merge(vars({ leetcode_session: s.id }), await render(s), pulse(s));
    // `leetuser` without any username asks for one.
    return asksUser && !user ? merge(action, profileSheet()) : action;
  }
  const s = read(id);
  const screen = top(s);
  switch (cmd) {
    case "load":
      return value === s.request ? load(s, value) : {};
    case "back":
      return back(s);
    case "query":
      if (value === s.query) return {};
      s.query = value;
      s.page = 0;
      s.request = randomUUID();
      s.status = "Searching…";
      return merge(await renderList(s), pulse(s));
    case "category":
      if (!CATEGORIES.some(([v]) => v === value) || value === s.category) return {};
      s.category = value;
      savePrefs({ category: value });
      s.page = 0;
      s.request = randomUUID();
      s.status = "Loading…";
      return merge(await renderList(s), pulse(s));
    case "select":
      if (!freshSelection(s)) return {};
      s.selected = value;
      save(s);
      return {};
    case "open": {
      if (screen.kind === "preview") return open(s.problem ? problemUrl(s.problem.slug) : URL_BASE);
      const uid = value || s.selected;
      if (uid === "more") {
        s.page++;
        s.request = randomUUID();
        s.status = "Loading more…";
        return merge(await renderList(s), pulse(s));
      }
      if (uid.startsWith("link:")) return open(uid.slice(5));
      if (uid.startsWith("profile:")) return open(profileUrl(s.profile?.username ?? ""));
      if (!uid) return {};
      s.selected = uid;
      return push(s, { kind: "preview", slug: uid });
    }
    case "browser":
      return open(value.startsWith("profile:") ? profileUrl(value.slice(8)) : problemUrl(value));
    case "copy-link":
      return copy(problemUrl(value || s.problem?.slug || ""));
    case "copy-problem":
      return s.problem
        ? copy(problemMarkdown(s.problem, { stats: showStats(), topics: bool("show_topics", false) }))
        : {};
    case "copy-template": {
      const snippet = s.problem?.snippets.find((x) => x.langSlug === value);
      return snippet
        ? merge(copy(snippet.code), update({ statusLabel: { text: `Copied ${snippet.lang} template` } }))
        : {};
    }
    case "daily":
      return push(s, { kind: "preview", slug: "", date: "today" });
    case "random":
      return formSheet(
        "randomSheet",
        "Pick a random problem",
        [
          picker("rCategory", s.filters.category, CATEGORIES),
          picker("rDifficulty", s.filters.difficulty, [
            ["", "Any difficulty"],
            ["EASY", "Easy"],
            ["MEDIUM", "Medium"],
            ["HARD", "Hard"],
          ]),
          picker("rTopic", s.filters.topic, [["", "Any topic"], ...TOPICS]),
          {
            id: "rPremium",
            type: "checkbox",
            text: "Exclude premium problems",
            checked: s.filters.excludePremium,
          },
        ],
        run(
          "random-pick",
          [
            "{value:rCategory.selected.value}",
            "{value:rDifficulty.selected.value}",
            "{value:rTopic.selected.value}",
            "{value:rPremium.checked}",
          ],
          false,
        ),
        "Pick",
      );
    case "random-pick": {
      const [category = "", difficulty = "", topic = "", premium = "1"] = process.argv.slice(4);
      s.filters = {
        category: valid(category, CATEGORIES),
        difficulty: ["EASY", "MEDIUM", "HARD"].includes(difficulty) ? difficulty : "",
        topic: valid(topic, TOPICS),
        excludePremium: premium === "1" || premium === "true",
      };
      savePrefs({ filters: s.filters });
      return merge(
        { sheet: { close: "randomSheet" } },
        await push(s, { kind: "preview", slug: "", random: true }, "Picking…"),
      );
    }
    case "another":
    case "refresh":
      s.request = randomUUID();
      if (screen.kind === "preview" && screen.random) {
        screen.slug = "";
        s.problem = undefined;
        s.status = "Picking…";
        return merge(await render(s), pulse(s));
      }
      s.page = 0;
      s.status = "Refreshing…";
      return merge(screen.kind === "search" ? await renderList(s) : await render(s), pulse(s));
    case "profile":
      return profileSheet();
    case "profile-user": {
      const name = (process.env.leetcode_user ?? "").trim();
      if (!/^[\w.-]{1,40}$/.test(name))
        return update({ uNote: { text: "Enter a LeetCode username.", colour: "systemRedColor" } });
      savePrefs({ username: name });
      return merge(
        { sheet: { close: "userSheet" } },
        await push(s, { kind: "profile", username: name }, "Loading profile…"),
      );
    }
    case "configure":
      execFileSync(
        "/usr/bin/osascript",
        [
          "-e",
          'tell application id "com.runningwithcrayons.Alfred" to reveal workflow "com.izsk.leetcode" configuration true',
        ],
        { timeout: 5000 },
      );
      return {};
    case "menu":
      return menu(s, value);
    default:
      return {};
  }
};

main()
  .then((action) => process.stdout.write(JSON.stringify(action), () => process.exit(0)))
  .catch((error) => process.stdout.write(JSON.stringify(errorStatus(error)), () => process.exit(0)));
