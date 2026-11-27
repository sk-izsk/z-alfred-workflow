// The Launchpad layout: pages of slots, each slot an app (by path) or a folder of apps. Pure
// functions, so the grid page and the tests share one set of rules.
import { appName } from "./apps.ts";

export type Folder = { name: string; apps: string[] };
/** A slot holds an app path or `folder:<id>`. */
export type Layout = { pages: string[][]; folders: Record<string, Folder> };

/** Apple's default Launchpad order, as seeded by the original workflow. */
export const DEFAULT_ORDER = [
  "/System/Applications/App Store.app",
  "/System/Volumes/Preboot/Cryptexes/App/System/Applications/Safari.app",
  "/System/Applications/Mail.app",
  "/System/Applications/Contacts.app",
  "/System/Applications/Calendar.app",
  "/System/Applications/Reminders.app",
  "/System/Applications/Notes.app",
  "/System/Applications/FaceTime.app",
  "/System/Applications/Messages.app",
  "/System/Applications/Maps.app",
  "/System/Applications/FindMy.app",
  "/System/Applications/Photos.app",
  "/System/Applications/Photo Booth.app",
  "/System/Applications/Image Playground.app",
  "/System/Applications/Music.app",
  "/System/Applications/Podcasts.app",
  "/System/Applications/VoiceMemos.app",
  "/System/Applications/TV.app",
  "/System/Applications/QuickTime Player.app",
  "/System/Applications/Weather.app",
  "/System/Applications/Stocks.app",
  "/System/Applications/Books.app",
  "/System/Applications/Clock.app",
  "/System/Applications/Calculator.app",
  "/System/Applications/Freeform.app",
  "/System/Applications/Home.app",
  "/System/Applications/Siri.app",
  "/System/Applications/Shortcuts.app",
  "/System/Applications/Passwords.app",
  "/System/Applications/TextEdit.app",
  "/System/Applications/Dictionary.app",
  "/System/Applications/Font Book.app",
  "/System/Applications/Preview.app",
  "/System/Applications/Time Machine.app",
  "/System/Applications/System Settings.app",
];

export const isFolder = (slot: string): boolean => slot.startsWith("folder:");
export const folderId = (slot: string): string => slot.slice(7);

const byName = (a: string, b: string) =>
  appName(a).localeCompare(appName(b), undefined, { sensitivity: "base" });

/** Pages of `size` slots from a flat list; `null` entries (the original's empty slots) are kept as page breaks. */
export const paginate = (slots: (string | null)[], size: number): string[][] => {
  const pages: string[][] = [];
  for (let i = 0; i < slots.length; i += size) {
    const page = slots.slice(i, i + size).filter((x): x is string => Boolean(x));
    if (page.length) pages.push(page);
  }
  return pages;
};

/**
 * The original workflow's saved order (`all_items` in Alfred's AlfredUI/Persist store): items with
 * `paths` (several paths = a group), `{}` for an empty slot.
 */
export const fromLegacy = (items: unknown, size: number): Layout => {
  const layout: Layout = { pages: [], folders: {} };
  if (!Array.isArray(items)) return layout;
  const slots: (string | null)[] = [];
  let n = 0;
  for (const item of items as { name?: string; paths?: unknown }[]) {
    const paths = Array.isArray(item?.paths)
      ? item.paths.filter((p): p is string => typeof p === "string")
      : [];
    if (!paths.length) slots.push(null);
    else if (paths.length === 1) slots.push(paths[0]!);
    else {
      const id = `f${++n}`;
      layout.folders[id] = { name: String(item.name || "Folder"), apps: paths };
      slots.push(`folder:${id}`);
    }
  }
  layout.pages = paginate(slots, size);
  return layout;
};

/** Apple's order first, then every other app by name. */
export const defaultLayout = (installed: string[], size: number): Layout => {
  const set = new Set(installed);
  const first = DEFAULT_ORDER.filter((p) => set.has(p));
  const rest = installed.filter((p) => !first.includes(p)).toSorted(byName);
  return { pages: paginate([...first, ...rest], size), folders: {} };
};

/**
 * Matches the layout to what is installed: removed apps disappear (folders of one app dissolve
 * into a plain app, empty folders and pages go), new apps are appended by name, and pages are
 * kept to `size` slots by flowing extra slots onto the next page.
 */
export const reconcile = (layout: Layout, installed: string[], size: number): Layout => {
  const present = new Set(installed);
  const folders: Record<string, Folder> = {};
  const seen = new Set<string>();
  const keep = (p: string) => present.has(p) && !seen.has(p) && (seen.add(p), true);
  const pages = layout.pages.map((page) =>
    page.flatMap((slot) => {
      if (!isFolder(slot)) return keep(slot) ? [slot] : [];
      const folder = layout.folders[folderId(slot)];
      const apps = (folder?.apps ?? []).filter(keep);
      if (apps.length >= 2) {
        folders[folderId(slot)] = { name: folder!.name, apps };
        return [slot];
      }
      return apps;
    }),
  );
  const added = installed.filter((p) => !seen.has(p)).toSorted(byName);
  const flat: (string | null)[] = [];
  // Keep page breaks: pad every page but the last to `size`, flowing any overflow forward.
  let carry: string[] = [];
  pages.forEach((page, i) => {
    const all = [...carry, ...page];
    const last = i === pages.length - 1;
    flat.push(...all.slice(0, size), ...(last ? [] : Array(Math.max(0, size - all.length)).fill(null)));
    carry = all.slice(size);
  });
  flat.push(...carry, ...added);
  return { pages: paginate(flat, size), folders };
};

/**
 * Checks a layout sent back by the grid page before it is saved: every slot must be a known app
 * or folder, no app may appear twice, folders need two or more apps and a short name.
 */
export const validLayout = (candidate: unknown, known: Set<string>, size: number): Layout => {
  const c = candidate as Partial<Layout>;
  if (!c || !Array.isArray(c.pages) || typeof c.folders !== "object" || c.folders === null)
    throw new Error("Invalid layout.");
  const seen = new Set<string>();
  const app = (p: unknown) => {
    if (typeof p !== "string" || !known.has(p) || seen.has(p)) throw new Error("Invalid layout.");
    seen.add(p);
    return p;
  };
  const folders: Record<string, Folder> = {};
  for (const [id, f] of Object.entries(c.folders)) {
    if (!/^f\w{1,24}$/.test(id) || !f || !Array.isArray(f.apps) || f.apps.length < 2) continue;
    folders[id] = {
      name:
        String(f.name ?? "")
          .trim()
          .slice(0, 60) || "Folder",
      apps: f.apps.map(app),
    };
  }
  const pages = c.pages
    .map((page) => {
      if (!Array.isArray(page) || page.length > size) throw new Error("Invalid layout.");
      return page.map((slot) => {
        if (typeof slot === "string" && isFolder(slot)) {
          if (!folders[folderId(slot)]) throw new Error("Invalid layout.");
          return slot;
        }
        return app(slot);
      });
    })
    .filter((page) => page.length);
  // A folder that isn't placed on any page would lose its apps: refuse it.
  const placed = new Set(pages.flat().filter(isFolder).map(folderId));
  if (Object.keys(folders).some((id) => !placed.has(id))) throw new Error("Invalid layout.");
  return { pages, folders };
};
