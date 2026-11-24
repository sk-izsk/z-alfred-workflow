import { str } from "../env.ts";

const entries = [
  {
    title: "Upcoming Events",
    subtitle: "Search events and join meetings",
    target: "agenda",
    words: "agenda meetings upcoming join cald",
    keyword: "kw_agenda",
    fallback: "cald",
  },
  {
    title: "Quick Calendar",
    subtitle: "Browse a month, jump between months and years",
    target: "quick",
    words: "quick calendar month year date calq",
    keyword: "kw_quick",
    fallback: "calq",
  },
  {
    title: "Create Event",
    subtitle: "Choose a calendar and add an event",
    target: "create",
    words: "create event new add schedule calc",
    keyword: "kw_create",
    fallback: "calc",
  },
];

export const rootItems = (query: string) => {
  const q = query.trim().toLowerCase();
  const [head = "", ...tail] = query.trim().split(/\s+/);
  const matched = entries.filter((e) =>
    q.split(/\s+/).every((word) =>
      `${e.title} ${e.words}`
        .toLowerCase()
        .split(/\s+/)
        .some((w) => w.startsWith(word)),
    ),
  );
  const direct = tail.length
    ? entries.find((e) => e.words.split(" ").includes(head.toLowerCase()))
    : undefined;
  const selected = matched.length ? matched : direct ? [direct] : [];
  return selected.map((entry) => ({
    uid: entry.target,
    title: entry.title,
    subtitle: `${entry.subtitle} · ${str(entry.keyword, entry.fallback)}`,
    icon: { path: "icon.png" },
    arg: direct?.target === entry.target ? tail.join(" ") : "",
    valid: true,
    variables: { cal_target: entry.target },
  }));
};
