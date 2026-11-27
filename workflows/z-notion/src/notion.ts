// Notion API (data sources, version 2025-09-03) with the user's integration secret from the Keychain.
// Mapping and behaviour follow the Raycast Notion extension's utils/notion (MIT).
import { APIErrorCode, Client, collectPaginatedAPI, isNotionClientError } from "@notionhq/client";
import { Readability } from "@mozilla/readability";
import { markdownToBlocks, markdownToRichText } from "@tryfabric/martian";
import { parseHTML } from "linkedom";
import { NotionToMarkdown } from "notion-to-md";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BUNDLE_ID, cacheDir, dataDir, readJson, writeJson } from "./env.ts";
import { run } from "./proc.ts";

// ---- Keychain ----

const ACCOUNT = "integration-secret";
export const DEMO = "demo";

export const readToken = async (): Promise<string | undefined> => {
  // ponytail: demo mode for README screenshots; shows the cache only, never calls Notion.
  if (process.env.nt_demo === "1") return DEMO;
  const { code, stdout } = await run("/usr/bin/security", [
    "find-generic-password",
    "-s",
    BUNDLE_ID,
    "-a",
    ACCOUNT,
    "-w",
  ]);
  if (code !== 0) return undefined;
  const value = stdout.trim();
  return value.startsWith("b64:")
    ? Buffer.from(value.slice(4), "base64").toString("utf8")
    : value || undefined;
};

/** `security -i` reads the command from stdin, so the secret never shows up in `ps`. */
export const saveToken = async (token: string): Promise<void> => {
  const encoded = `b64:${Buffer.from(token.trim(), "utf8").toString("base64")}`;
  const { code, stderr } = await run("/usr/bin/security", ["-i"], {
    input: `add-generic-password -U -s "${BUNDLE_ID}" -a "${ACCOUNT}" -w "${encoded}"\n`,
  });
  if (code !== 0 || /error/i.test(stderr)) throw new Error(`Keychain write failed: ${stderr.trim()}`);
};

export const deleteToken = async (): Promise<void> => {
  await run("/usr/bin/security", ["delete-generic-password", "-s", BUNDLE_ID, "-a", ACCOUNT]);
};

let client: Client | undefined;
export const connect = (token: string): Client => (client = new Client({ auth: token, timeoutMs: 20_000 }));
const notion = (): Client => {
  if (!client) throw new Error("Not connected to Notion");
  return client;
};
export const whoAmI = async () => {
  const me: any = await notion().users.me({});
  return String(me.bot?.workspace_name ?? me.name ?? "Notion");
};

/** Words a person can act on; raw API messages mention internal ids. */
export const describeError = (error: unknown): string => {
  if (isNotionClientError(error)) {
    switch (error.code) {
      case APIErrorCode.Unauthorized:
        return "Notion rejected the integration secret. Paste a new one in Manage Connection.";
      case APIErrorCode.RestrictedResource:
      case APIErrorCode.ObjectNotFound:
        return "The integration can't see that page. In Notion: ⋯ → Connections → add your integration.";
      case APIErrorCode.RateLimited:
        return "Notion is rate limiting requests. Wait a few seconds and try again.";
      case APIErrorCode.ValidationError:
        return `Notion didn't accept that: ${error.message}`;
    }
  }
  return error instanceof Error ? error.message : String(error);
};
export const isUnauthorized = (error: unknown) =>
  isNotionClientError(error) && error.code === APIErrorCode.Unauthorized;

// ---- Model ----

export type Option = { id: string; name: string; color?: string };
export type PropValue =
  | {
      type: "title" | "rich_text" | "url" | "email" | "phone_number" | "number" | "formula" | "other";
      text: string;
    }
  | { type: "checkbox"; checked: boolean }
  | { type: "select" | "status"; option?: Option }
  | { type: "multi_select"; options: Option[] }
  | { type: "people" | "relation"; ids: string[] }
  | { type: "date"; start?: string; end?: string };
export type Prop = { id: string; name: string } & PropValue;

export type Page = {
  object: "page" | "database";
  id: string;
  title: string;
  emoji?: string;
  iconUrl?: string;
  url?: string;
  lastEdited?: number;
  lastEditedBy?: string;
  createdBy?: string;
  properties: Prop[];
};
export type DbProp = { id: string; name: string; type: string; options?: Option[]; relation?: string };
export type User = { id: string; name: string; avatar?: string };

type Raw = Record<string, any>;
const plain = (rich: Raw[] | undefined) => (rich ?? []).map((t) => t.plain_text ?? "").join("");

const propValue = (p: Raw): PropValue => {
  switch (p.type) {
    case "title":
    case "rich_text":
      return { type: p.type, text: plain(p[p.type]) };
    case "url":
    case "email":
    case "phone_number":
      return { type: p.type, text: p[p.type] ?? "" };
    case "number":
      return { type: "number", text: p.number == null ? "" : String(p.number) };
    case "checkbox":
      return { type: "checkbox", checked: Boolean(p.checkbox) };
    case "select":
    case "status":
      return { type: p.type, option: p[p.type] ?? undefined };
    case "multi_select":
      return { type: "multi_select", options: p.multi_select ?? [] };
    case "people":
      return { type: "people", ids: (p.people ?? []).map((u: Raw) => u.id) };
    case "relation":
      return { type: "relation", ids: (p.relation ?? []).map((r: Raw) => r.id) };
    case "date":
      return { type: "date", start: p.date?.start, end: p.date?.end ?? undefined };
    case "formula": {
      const f = p.formula ?? {};
      const v = f[f.type];
      return { type: "formula", text: v == null ? "" : typeof v === "object" ? (v.start ?? "") : String(v) };
    }
    case "created_by":
    case "last_edited_by":
      return { type: "people", ids: p[p.type]?.id ? [p[p.type].id] : [] };
    default:
      return { type: "other", text: typeof p[p.type] === "string" ? p[p.type] : "" };
  }
};

export const pageMapper = (o: Raw): Page => {
  const isPage = o.object === "page";
  const properties: Prop[] = isPage
    ? Object.entries((o.properties ?? {}) as Record<string, Raw>).map(([name, p]) => ({
        id: p.id,
        name,
        ...propValue(p),
      }))
    : [];
  const titleProp = properties.find((p) => p.type === "title");
  const title = (titleProp && "text" in titleProp ? titleProp.text : plain(o.title)) || "Untitled";
  return {
    object: isPage ? "page" : "database",
    id: o.id,
    title,
    emoji: o.icon?.type === "emoji" ? o.icon.emoji : undefined,
    iconUrl:
      o.icon?.type === "file"
        ? o.icon.file.url
        : o.icon?.type === "external"
          ? o.icon.external.url
          : undefined,
    url: o.url,
    lastEdited: o.last_edited_time ? Date.parse(o.last_edited_time) : undefined,
    lastEditedBy: o.last_edited_by?.id,
    createdBy: o.created_by?.id,
    properties,
  };
};

// ---- Reading ----

export const search = async (query: string, pageSize = 30) => {
  const result = await notion().search({
    ...(query && { query }),
    sort: { direction: "descending", timestamp: "last_edited_time" },
    page_size: pageSize,
  });
  return result.results.map((r) => pageMapper(r as Raw));
};

/** Data sources the integration can see (what Create Database Page offers). */
export const databases = async (): Promise<Page[]> => {
  const results = await collectPaginatedAPI(notion().search, {
    filter: { property: "object", value: "data_source" },
    sort: { direction: "descending", timestamp: "last_edited_time" },
  } as never);
  return results.map((r) => pageMapper(r as Raw));
};

export const users = async (): Promise<User[]> => {
  try {
    const list = await collectPaginatedAPI(notion().users.list, {});
    return (list as Raw[])
      .filter((u) => u.type === "person")
      .map((u) => ({ id: u.id, name: u.name ?? "Unknown", avatar: u.avatar_url ?? undefined }));
  } catch {
    return []; // the integration may lack "Read user information"
  }
};

/** Search results carry database ids; newer API calls want the data source id. */
const dataSourceId = async (id: string): Promise<string> => {
  try {
    await notion().dataSources.retrieve({ data_source_id: id });
    return id;
  } catch {
    try {
      const database = (await notion().databases.retrieve({ database_id: id })) as Raw;
      return database.data_sources?.[0]?.id ?? id;
    } catch {
      return id;
    }
  }
};

const READABLE = [
  "title",
  "rich_text",
  "number",
  "url",
  "email",
  "phone_number",
  "date",
  "checkbox",
  "select",
  "status",
  "multi_select",
  "people",
  "relation",
  "formula",
];

export const databaseProperties = async (id: string): Promise<DbProp[]> => {
  const source = (await notion().dataSources.retrieve({ data_source_id: await dataSourceId(id) })) as Raw;
  return Object.entries((source.properties ?? {}) as Record<string, Raw>)
    .filter(([, p]) => READABLE.includes(p.type))
    .map(([name, p]) => ({
      id: p.id,
      name,
      type: p.type,
      options: p[p.type]?.options,
      relation: p.relation?.data_source_id ?? p.relation?.database_id,
    }))
    .toSorted((a, b) => (a.type === "title" ? -1 : b.type === "title" ? 1 : 0));
};

export const queryDatabase = async (
  id: string,
  query: string,
  sort: "last_edited_time" | "created_time",
): Promise<Page[]> => {
  const pages = await collectPaginatedAPI(notion().dataSources.query, {
    data_source_id: await dataSourceId(id),
    page_size: 100,
    sorts: [{ direction: "descending", timestamp: sort }],
    ...(query && { filter: { property: "title", title: { contains: query } } }),
  } as never);
  return pages.map((r) => pageMapper(r as Raw));
};

export const pageMarkdown = async (id: string): Promise<string> => {
  const { results } = await notion().blocks.children.list({ block_id: id });
  if (!results.length) return "*Page is empty*";
  const n2m = new NotionToMarkdown({ notionClient: notion() });
  return n2m.toMarkdownString(await n2m.blocksToMarkdown(results)).parent ?? "";
};

// ---- Writing ----

const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const localIso = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString();

/** A divider and a date mention, as Raycast's "Append with a date divider". */
const dateDivider = (): Raw[] => [
  { divider: {} },
  {
    paragraph: {
      rich_text: [
        { type: "mention", mention: { date: { start: localIso(new Date()), time_zone: timezone() } } },
      ],
    },
  },
];

export type FormValue = string | boolean | string[] | { date: Date; allDay: boolean } | undefined;

/** One form value as a Notion property value (as Raycast's formValueToPropertyValue). */
export const propertyValue = (type: string, value: FormValue): Raw | undefined => {
  if (value === undefined || value === "" || value === "_none_") return undefined;
  switch (type) {
    case "title":
      return { title: markdownToRichText(String(value)) };
    case "rich_text":
      return { rich_text: markdownToRichText(String(value)) };
    case "number": {
      const n = Number(value);
      return Number.isFinite(n) ? { number: n } : undefined;
    }
    case "checkbox":
      return { checkbox: Boolean(value) };
    case "select":
      return { select: { id: String(value) } };
    case "status":
      return { status: { id: String(value) } };
    case "multi_select":
      return { multi_select: (value as string[]).map((id) => ({ id })) };
    case "people":
      return { people: (value as string[]).map((id) => ({ id })) };
    case "relation":
      return { relation: (value as string[]).map((id) => ({ id })) };
    case "url":
    case "email":
    case "phone_number":
      return { [type]: String(value) };
    case "date": {
      const { date, allDay } = value as { date: Date; allDay: boolean };
      const iso = localIso(date);
      return allDay
        ? { date: { start: iso.slice(0, 10) } }
        : { date: { start: iso.slice(0, 19), time_zone: timezone() } };
    }
    default:
      return undefined;
  }
};

export const createDatabasePage = async (
  database: string,
  values: { id: string; type: string; value: FormValue }[],
  content: string,
  addDateDivider = false,
): Promise<Page> => {
  const properties: Record<string, Raw> = {};
  for (const v of values) {
    const formatted = propertyValue(v.type, v.value);
    if (formatted) properties[v.id] = formatted;
  }
  const blocks = typeof content === "string" && content ? (markdownToBlocks(content) as Raw[]) : [];
  const children = addDateDivider ? [...dateDivider(), ...blocks] : blocks;
  const created = await notion().pages.create({
    parent: { data_source_id: await dataSourceId(database) },
    properties,
    ...(children.length && { children }),
  } as never);
  return pageMapper(created as Raw);
};

export const appendToPage = async (
  pageId: string,
  content: string | Raw[],
  options: { prepend?: boolean; dateDivider?: boolean } = {},
): Promise<void> => {
  const blocks = typeof content === "string" ? (markdownToBlocks(content) as Raw[]) : content;
  const children = options.dateDivider ? [...dateDivider(), ...blocks] : blocks;
  let after: string | undefined;
  if (options.prepend) {
    const { results } = await notion().blocks.children.list({ block_id: pageId, page_size: 1 });
    after = results[0]?.id;
  }
  await notion().blocks.children.append({ block_id: pageId, children, ...(after && { after }) } as never);
};

const EMPTY: Record<string, Raw> = {
  select: { select: null },
  status: { status: null },
  multi_select: { multi_select: [] },
  people: { people: [] },
};
export const setProperty = async (pageId: string, propId: string, type: string, value: FormValue) => {
  const updated = await notion().pages.update({
    page_id: pageId,
    properties: { [propId]: propertyValue(type, value) ?? EMPTY[type] },
  } as never);
  return pageMapper(updated as Raw);
};

/** Notion moves deleted pages and databases to its trash, from where they can be restored. */
export const trash = async (item: Page) => {
  if (item.object === "page") await notion().pages.update({ page_id: item.id, in_trash: true } as never);
  else
    await notion().dataSources.update({
      data_source_id: await dataSourceId(item.id),
      in_trash: true,
    } as never);
};

// ---- Add Note (Raycast's utils/notion/notes.ts, with a JSON file for its id cache) ----

const notesCache = () => join(dataDir(), "notes.json");
const cachedId = async (key: string) => {
  const id = readJson<Record<string, string>>(notesCache(), {})[key];
  if (!id) return undefined;
  try {
    const found = (await notion().pages.retrieve({ page_id: id })) as Raw;
    if (!found.archived && !found.in_trash) return id;
  } catch {
    // gone: forget it
  }
  const all = readJson<Record<string, string>>(notesCache(), {});
  delete all[key];
  writeJson(notesCache(), all);
  return undefined;
};
const remember = (key: string, id: string) =>
  writeJson(notesCache(), { ...readJson<Record<string, string>>(notesCache(), {}), [key]: id });

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const findChildPage = async (parent: string, title: string) => {
  const blocks = await collectPaginatedAPI(notion().blocks.children.list, { block_id: parent });
  return (blocks as Raw[]).find((b) => b.type === "child_page" && same(b.child_page.title, title))?.id as
    | string
    | undefined;
};
const findTopPage = async (title: string) => {
  const results = await collectPaginatedAPI(notion().search, {
    query: title,
    filter: { property: "object", value: "page" },
  } as never);
  return (results as Raw[]).find((r) => {
    const parent = r.parent?.type;
    return parent !== "database_id" && parent !== "data_source_id" && same(pageMapper(r).title, title);
  })?.id as string | undefined;
};
const createChild = async (parent: string, title: string, emoji?: string) =>
  (
    await notion().pages.create({
      parent: { page_id: parent },
      ...(emoji && { icon: { type: "emoji", emoji } }),
      properties: { title: { title: [{ text: { content: title } }] } },
    } as never)
  ).id;

export class MissingNotesRoot extends Error {}

export const noteBlock = (note: string, style: string): Raw => {
  const rich_text: Raw[] = [];
  for (let i = 0; i < note.length; i += 2000)
    rich_text.push({ type: "text", text: { content: note.slice(i, i + 2000) } });
  if (style === "todo") return { to_do: { rich_text, checked: false } };
  if (style === "paragraph") return { paragraph: { rich_text } };
  return { bulleted_list_item: { rich_text } };
};

/** Appends to today's page inside the notes page, creating both when needed. */
export const addNote = async (
  note: string,
  rootName: string,
  dateTitle: string,
  style: string,
  parent?: string,
) => {
  const rootKey = `root::${rootName.toLowerCase()}`;
  let root = await cachedId(rootKey);
  if (!root) {
    root = (parent ? await findChildPage(parent, rootName) : undefined) ?? (await findTopPage(rootName));
    if (!root) {
      if (!parent)
        throw new MissingNotesRoot(`There is no “${rootName}” page yet. Choose a parent page for it.`);
      root = await createChild(parent, rootName, "🗒️");
    }
    remember(rootKey, root);
  }
  const dayKey = `day::${root}::${dateTitle}`;
  let day = await cachedId(dayKey);
  if (!day) {
    day = (await findChildPage(root, dateTitle)) ?? (await createChild(root, dateTitle));
    remember(dayKey, day);
  }
  await notion().blocks.children.append({ block_id: day, children: [noteBlock(note, style)] } as never);
  return day;
};

// ---- Quick Capture ----

export const isUrl = (text: string) => /^(https?:\/\/|www\.)\S+\.\S+$/i.test(text.trim());

/** Page title and readable text, read as Raycast's Quick Capture does (Readability). */
export const readWebPage = async (url: string): Promise<{ title: string; text: string } | undefined> => {
  try {
    const response = await fetch(url.startsWith("www.") ? `https://${url}` : url, {
      signal: AbortSignal.timeout(15_000),
    });
    const { document } = parseHTML(await response.text()) as unknown as { document: Raw };
    const article = new Readability(document as never).parse();
    return { title: String(document.title || url), text: article?.textContent?.trim() ?? "" };
  } catch {
    return undefined;
  }
};

/** A bookmark block, or a link with the page text (Full Page). */
export const captureContent = (
  url: string,
  as: string,
  detail?: { title: string; text: string },
): string | Raw[] => {
  if (as === "url") return [{ type: "bookmark", bookmark: { url } }];
  const link = detail ? `[${detail.title.replace(/[[\]]/g, "")}](${url})` : url;
  return as === "full" && detail?.text ? `${link}\n\n${detail.text.slice(0, 50_000)}` : link;
};

// ---- Cache, pictures ----

export const cached = <T>(name: string): T | undefined =>
  readJson<T | undefined>(join(cacheDir(), `${name}.json`), undefined);
export const store = (name: string, value: unknown): void =>
  writeJson(join(cacheDir(), `${name}.json`), value);

/** Notion's signed file URLs change; pictures are keyed by URL path. */
const pictureFile = (url: string) =>
  join(
    cacheDir(),
    "pictures",
    `${createHash("sha1")
      .update(url.split("?")[0] ?? url)
      .digest("hex")}.img`,
  );
export const picturePath = (url: string | undefined) =>
  url && existsSync(pictureFile(url)) ? pictureFile(url) : undefined;

export const downloadPictures = async (urls: (string | undefined)[]): Promise<void> => {
  mkdirSync(join(cacheDir(), "pictures"), { recursive: true });
  const missing = [...new Set(urls.filter((u): u is string => Boolean(u)))].filter((u) => !picturePath(u));
  await Promise.all(
    missing.slice(0, 40).map(async (url) => {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (response.ok) writeFileSync(pictureFile(url), Buffer.from(await response.arrayBuffer()));
      } catch {
        // falls back to a symbol
      }
    }),
  );
};
