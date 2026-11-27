// Native Alfred UI screens: problem search (list + category), problem preview (markdown) and profile.
import type { Json } from "../../../shared/dashboard.ts";
import { CATEGORIES, type Difficulty, type ProblemRow, type Profile } from "./api.ts";

const CLI = "../bin/leetcode";
export const run = (cmd: string, args: string[] = [], async = true): Json => ({
  type: "script",
  src: CLI,
  args: [cmd, "{var:leetcode_session}", ...args],
  async,
});
export const SELECTED = "{value:items.selected.uid}";

/** LeetCode's own difficulty colours, as text on a faint tint. */
const DIFFICULTY: Record<Difficulty, string> = { Easy: "#2db55d", Medium: "#ffa116", Hard: "#ef4743" };
const ratingColour = (r: number) =>
  r < 1200 ? "#2db55d" : r < 1600 ? "#d8b92a" : r < 2000 ? "#ffa116" : "#ef4743";

const badge = (id: string): Json => ({
  id: `${id}Box`,
  type: "view",
  layout: "stack",
  cornerradius: 6,
  padding: 4,
  components: [{ id, type: "label", text: "", font: { size: 13, weight: "medium" } }],
});

/** One row: "N. Title  58.2%" on the left; lock, rating and difficulty on the right. */
const cell: Json = {
  height: 48,
  init: { "row.background": null },
  selected: { "row.background": "alfredSelectedResultBackgroundColor" },
  root: {
    id: "row",
    type: "view",
    layout: "border",
    padding: 10,
    spacing: 10,
    cornerradius: 8,
    components: [
      {
        type: "view",
        layout: "inline",
        spacing: 10,
        constraints: { region: "centre" },
        components: [
          { id: "rowTitle", type: "label", text: "", font: { size: 15 }, linebreak: "truncatetail" },
          { id: "rowNote", type: "label", text: "", font: { size: 14 }, colour: "secondaryLabelColor" },
        ],
      },
      {
        type: "view",
        layout: "inline",
        spacing: 8,
        constraints: { region: "right" },
        components: [
          {
            id: "rowLock",
            type: "imageview",
            image: { type: "symbol", src: "lock.fill" },
            contenttintcolour: "secondaryLabelColor",
            constraints: { size: { width: 13, height: 13 } },
          },
          badge("rowRating"),
          badge("rowLevel"),
        ],
      },
    ],
  },
};

const tag = (id: string, text: string, colour: string | null): Json => ({
  [`${id}.text`]: text,
  [`${id}.colour`]: colour,
  [`${id}Box.background`]: text && colour ? `${colour}26` : null,
});

export const problemRow = (p: ProblemRow, rating?: number | null, showStats = true): Json => ({
  uid: p.slug,
  "rowTitle.text": `${p.id}. ${p.title}`,
  "rowNote.text": showStats ? (p.acRate ?? "") : "",
  "rowLock.hidden": !p.paid,
  ...tag(
    "rowRating",
    rating === undefined ? "" : rating === null ? "Unrated" : String(rating),
    rating ? ratingColour(rating) : rating === null ? "#8e8e93" : null,
  ),
  ...tag("rowLevel", showStats ? p.difficulty : "", DIFFICULTY[p.difficulty]),
});

/** A plain information row (profile screen); `uid` decides what ↩ does. */
export const infoRow = (uid: string, title: string, note = "", level?: [string, string]): Json => ({
  uid,
  "rowTitle.text": title,
  "rowNote.text": note,
  "rowLock.hidden": true,
  ...tag("rowRating", "", null),
  ...tag("rowLevel", level?.[0] ?? "", level?.[1] ?? null),
});

const footer = (primary: string, status: string): Json => ({
  type: "view",
  layout: "border",
  padding: 12,
  spacing: 8,
  constraints: { region: "bottom" },
  components: [
    {
      id: "statusLabel",
      type: "label",
      text: status,
      font: { size: 10 },
      colour: "secondaryLabelColor",
      linebreak: "truncatetail",
      constraints: { region: "centre", stretch: "horizontal" },
    },
    {
      type: "view",
      layout: "inline",
      spacing: 10,
      constraints: { region: "right" },
      components: [
        {
          id: "back",
          type: "button",
          text: "Back  {var:back_label}",
          shortcut: "{var:back_shortcut}",
          bordered: false,
          events: [{ triggers: "actioned", action: run("back", [], false) }],
        },
        {
          id: "primary",
          type: "button",
          text: `${primary}  ↩`,
          bordered: false,
          events: [{ triggers: "actioned", action: run("open", [SELECTED]) }],
        },
        {
          id: "actionsButton",
          type: "button",
          text: "Actions  {var:actions_label}",
          bordered: false,
          events: [{ triggers: "actioned", action: run("menu", [SELECTED], false) }],
        },
      ],
    },
  ],
});

const list = (rows: Json[], placeholder: string, selected: string): Json => ({
  id: "items",
  type: "dataview",
  padding: 8,
  spacing: 2,
  data: { type: "basic", src: rows },
  select: selected,
  placeholder,
  constraints: { region: "centre" },
  cell,
  events: [
    { triggers: "changed", action: run("select", ["{value:self.selected.uid}"]) },
    { triggers: "actioned", action: run("open", ["{value:self.selected.uid}"]) },
  ],
});

export const searchScreen = (
  query: string,
  category: string,
  rows: Json[],
  selected: string,
  status: string,
): Json[] => [
  {
    type: "view",
    layout: "border",
    padding: 16,
    spacing: 12,
    constraints: { region: "top" },
    components: [
      {
        id: "query",
        type: "textfield",
        text: query,
        placeholder: "Search LeetCode problems…",
        focus: true,
        bordered: false,
        focusring: false,
        background: null,
        font: { size: 23, weight: "light" },
        constraints: { region: "centre" },
        events: [
          { triggers: "typingstopped", action: run("query", ["{value:self.text}"]) },
          { triggers: "actioned", action: run("open", [SELECTED]) },
        ],
      },
      {
        id: "category",
        type: "picker",
        selected: category,
        items: CATEGORIES.map(([value, text]) => ({ text, value })),
        constraints: { region: "right", size: { width: 170 } },
        events: [{ triggers: "changed", action: run("category", ["{value:self.selected.value}"]) }],
      },
    ],
  },
  list(rows, "Loading…", selected),
  footer("Preview Problem", status),
];

export const previewScreen = (markdown: string, status: string): Json[] => [
  {
    id: "preview",
    type: "markdownarea",
    text: markdown,
    padding: 18,
    constraints: { region: "centre" },
  },
  footer("Open in Browser", status),
];

const n = (v: number | null | undefined) => (v == null ? "N/A" : v.toLocaleString("en-US"));
export const profileRows = (p: Profile): Json[] => {
  const rows: Json[] = [
    infoRow(
      "profile",
      p.realName ? `${p.realName} (${p.username})` : p.username,
      [p.country, p.company, p.school].filter(Boolean).join(" · "),
    ),
    infoRow(
      "profile",
      `Solved ${n(p.solved.All)} of ${n(p.totals.All)}`,
      `Ranking #${n(p.ranking)} · Reputation ${n(p.reputation)}`,
    ),
    ...(["Easy", "Medium", "Hard"] as Difficulty[]).map((d) =>
      infoRow("profile", `${n(p.solved[d])} of ${n(p.totals[d])}`, "", [d, DIFFICULTY[d]]),
    ),
    infoRow("profile", `Streak ${p.streak} days`, `${p.activeDays} active days this year`),
    p.contest
      ? infoRow(
          "profile",
          `Contest rating ${p.contest.rating}`,
          `Rank #${n(p.contest.globalRanking)} · Top ${p.contest.topPercentage?.toFixed(1) ?? "N/A"}% · ${p.contest.attended} contests${p.contest.badge ? ` · ${p.contest.badge}` : ""}`,
        )
      : infoRow("profile", "No contests yet"),
    ...(p.badges.length ? [infoRow("profile", "Badges", p.badges.slice(0, 6).join(", "))] : []),
    ...p.links.map((l) => infoRow(`link:${l.url}`, l.label, l.url.replace(/^https?:\/\/(www\.)?/, ""))),
  ];
  if (p.recent.length) rows.push(infoRow("profile", "Recent accepted submissions"));
  for (const s of p.recent) rows.push(infoRow(s.slug, s.title, ago(s.timestamp)));
  // uids must be unique: information rows become profile:0, profile:1, … (↩ opens the profile).
  return rows.map((row, i) => (row.uid === "profile" ? { ...row, uid: `profile:${i}` } : row));
};

export const profileScreen = (rows: Json[], selected: string, status: string): Json[] => [
  list(rows, "Loading profile…", selected),
  footer("Open", status),
];

export const ago = (time: number, now = Date.now()): string => {
  const m = Math.round((now - time) / 60_000);
  if (m < 60) return `${Math.max(m, 1)}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};
