// Synthetic Notion data (made-up people and pages), shaped like API responses and the mapped model.
import type { DbProp, Page, User } from "../src/notion.ts";

const minutesAgo = (m: number) => Date.now() - m * 60_000;

export const users: User[] = [
  { id: "u1", name: "Alex Morgan" },
  { id: "u2", name: "Jamie Chen" },
  { id: "u3", name: "Sam Taylor" },
];

export const rawPage = {
  object: "page",
  id: "p-theme",
  url: "https://www.notion.so/Theme-Explorer-abc",
  icon: { type: "emoji", emoji: "🎨" },
  last_edited_time: "2026-01-04T12:00:00.000Z",
  last_edited_by: { object: "user", id: "u1" },
  created_by: { object: "user", id: "u1" },
  parent: { type: "data_source_id", data_source_id: "db-proposals" },
  properties: {
    Name: { id: "title", type: "title", title: [{ plain_text: "Theme " }, { plain_text: "Explorer" }] },
    Status: { id: "st", type: "status", status: { id: "acc", name: "Accepted", color: "green" } },
    Category: { id: "cat", type: "select", select: { id: "prod", name: "Product", color: "blue" } },
    Reviewers: { id: "rev", type: "people", people: [{ id: "u2" }, { id: "u3" }] },
    Done: { id: "done", type: "checkbox", checkbox: true },
    Due: { id: "due", type: "date", date: { start: "2026-10-12", end: null } },
    Score: { id: "num", type: "number", number: 7 },
  },
};

const page = (id: string, title: string, emoji: string, m: number, props: Page["properties"] = []): Page => ({
  object: "page",
  id,
  title,
  emoji,
  url: `https://www.notion.so/${id}`,
  lastEdited: minutesAgo(m),
  lastEditedBy: "u1",
  createdBy: "u1",
  properties: props,
});
const tag = (name: string, color: string) => ({ id: name.toLowerCase(), name, color });
const article = (
  id: string,
  title: string,
  m: number,
  topic: [string, string],
  state: [string, string],
): Page =>
  page(id, title, "📄", m, [
    { id: "title", name: "Name", type: "title", text: title },
    { id: "topic", name: "Topic", type: "select", option: tag(...topic) },
    { id: "state", name: "Status", type: "status", option: tag(...state) },
  ]);

export const pages: Page[] = [
  { ...page("db-api", "API & Extensions", "⚙️", 2), object: "database" },
  { ...page("db-articles", "Articles", "📄", 2), object: "database" },
  page("p-pixel", "Pixel Rumble", "👾", 2),
  page("p-design", "Design", "🎨", 2),
  { ...page("db-proposals", "Proposals List", "📋", 2), object: "database" },
  page("p-eng", "Engineering", "🤖", 2),
  page("p-theme", "Theme Explorer", "🎨", 1),
  page("p-safari", "Safari Link Tracking Protection", "📄", 4),
];

export const articles: Page[] = [
  article("a1", "Safari Link Tracking Protection", 5, ["Tech", "blue"], ["To read", "default"]),
  article("a2", "A Breakdown of HTTP Clients in Elixir", 6, ["Dev", "green"], ["Read", "green"]),
  article("a3", "How Our Attention Shapes What We Learn", 7, ["Science", "purple"], ["Reading", "orange"]),
  article("a4", "Attention Is Off By One", 8, ["Tech", "blue"], ["To read", "default"]),
  article("a5", "From Python to Elixir Machine Learning", 9, ["Dev", "green"], ["Read", "green"]),
  article("a6", "Building Better Developer Tools", 10, ["Science", "purple"], ["Reading", "orange"]),
  article("a7", "How Undersea Sounds Reveal Ocean Life", 11, ["Tech", "blue"], ["To read", "default"]),
  article("a8", "Arc from The Browser Company", 12, ["Dev", "green"], ["Read", "green"]),
  article("a9", "Designing a More Open Web", 13, ["Science", "purple"], ["Reading", "orange"]),
];

export const articleProps: DbProp[] = [
  { id: "title", name: "Name", type: "title" },
  {
    id: "topic",
    name: "Topic",
    type: "select",
    options: [tag("Tech", "blue"), tag("Dev", "green"), tag("Science", "purple")],
  },
  {
    id: "state",
    name: "Status",
    type: "status",
    options: [tag("To read", "default"), tag("Reading", "orange"), tag("Read", "green")],
  },
];

export const meetingProps: DbProp[] = [
  { id: "title", name: "Name", type: "title" },
  { id: "date", name: "Date", type: "date" },
  {
    id: "type",
    name: "Type",
    type: "select",
    options: [tag("Eng Meeting", "orange"), tag("Review", "blue")],
  },
  { id: "people", name: "Participants", type: "people" },
  { id: "f", name: "Formula", type: "formula" },
];
