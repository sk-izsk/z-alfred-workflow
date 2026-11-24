import { createWriteStream, existsSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { editor, product } from "./editors.ts";
import { cacheDir } from "./env.ts";

export type GalleryExtension = {
  id: string;
  name: string;
  publisher: string;
  description: string;
  version: string;
  installs: number | undefined;
  iconUrl: string;
};

type Raw = {
  publisher: { publisherName: string; displayName: string };
  extensionName: string;
  displayName: string;
  shortDescription?: string;
  versions?: { version: string; files?: { assetType: string; source: string }[] }[];
  statistics?: { statisticName: string; value: number }[];
};

const VS_MARKETPLACE = "https://marketplace.visualstudio.com/_apis/public/gallery";
const OPEN_VSX = "https://open-vsx.org/vscode/gallery";

/** The app's own gallery (Open VSX for most forks), falling back by build. */
const galleryUrl = (): string => {
  const configured = product().extensionsGallery?.serviceUrl?.replace(/\/+$/, "");
  if (configured) return configured;
  return editor().id.startsWith("Code") ? VS_MARKETPLACE : OPEN_VSX;
};

export const galleryName = (): string => {
  const url = galleryUrl();
  if (url.includes("visualstudio.com")) return "VS Code Marketplace";
  if (url.includes("open-vsx") || url.includes("cursor")) return "Open VSX";
  return new URL(url).host;
};

export const itemUrl = (id: string): string => {
  const base = product().extensionsGallery?.itemUrl?.replace(/\/+$/, "");
  return `${base || (galleryUrl() === VS_MARKETPLACE ? "https://marketplace.visualstudio.com/items" : "https://open-vsx.org/vscode/item")}?itemName=${id}`;
};

/** The Marketplace's own categories (filterType 5). */
export const CATEGORIES = [
  "Themes",
  "Programming Languages",
  "Snippets",
  "Formatters",
  "Linters",
  "Debuggers",
  "Keymaps",
  "AI",
  "Chat",
  "Testing",
  "SCM Providers",
  "Notebooks",
  "Data Science",
  "Visualization",
  "Extension Packs",
  "Language Packs",
  "Education",
  "Other",
];

/** Same request body VS Code sends. No text = most installed (in the category, if one is picked). */
const body = (text: string, category: string) =>
  JSON.stringify({
    filters: [
      {
        criteria: [
          { filterType: 8, value: "Microsoft.VisualStudio.Code" },
          ...(text ? [{ filterType: 10, value: text }] : []),
          ...(category ? [{ filterType: 5, value: category }] : []),
          { filterType: 12, value: "4096" }, // exclude unpublished
        ],
        pageNumber: 1,
        pageSize: 50,
        sortBy: text ? 0 : 4, // relevance, or install count
        sortOrder: text ? 0 : 2,
      },
    ],
    assetTypes: [],
    // IncludeFiles | IncludeCategoryAndTags | IncludeVersionProperties | ExcludeNonValidated | IncludeAssetUri | IncludeStatistics
    flags: 0x2 | 0x4 | 0x10 | 0x20 | 0x80 | 0x100,
  });

export const toGallery = (raw: Raw): GalleryExtension => {
  const latest = raw.versions?.[0];
  return {
    id: `${raw.publisher.publisherName}.${raw.extensionName}`,
    name: raw.displayName || raw.extensionName,
    publisher: raw.publisher.displayName,
    description: raw.shortDescription ?? "",
    version: latest?.version ?? "",
    installs: raw.statistics?.find((s) => s.statisticName === "install")?.value,
    iconUrl:
      latest?.files?.find((f) => f.assetType === "Microsoft.VisualStudio.Services.Icons.Default")?.source ??
      "",
  };
};

export const searchGallery = async (text: string, category = ""): Promise<GalleryExtension[]> => {
  const res = await fetch(`${galleryUrl()}/extensionquery?api-version=3.0-preview.1`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json;api-version=3.0-preview.1" },
    body: body(text.trim(), category),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`${galleryName()} returned ${res.status}`);
  const json = (await res.json()) as { results?: { extensions?: Raw[] }[] };
  return (json.results?.[0]?.extensions ?? []).map(toGallery);
};

const iconDir = () => {
  const dir = join(cacheDir(), "icons");
  mkdirSync(dir, { recursive: true });
  return dir;
};

export const cachedIcon = (id: string): string => join(iconDir(), `${id.toLowerCase()}.png`);

/**
 * Alfred UI can't load images from URLs, so download icons to the cache.
 * Returns once all are done or `budgetMs` passes (slow ones show the default icon this time).
 */
export const fetchIcons = async (list: GalleryExtension[], budgetMs = 1500): Promise<void> => {
  const missing = list.filter((e) => e.iconUrl && !existsSync(cachedIcon(e.id)));
  const download = async (e: GalleryExtension) => {
    const res = await fetch(e.iconUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok || !res.body) return;
    const temp = `${cachedIcon(e.id)}.${process.pid}.tmp`;
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(temp));
    renameSync(temp, cachedIcon(e.id));
  };
  await Promise.race([
    Promise.allSettled(missing.map(download)),
    new Promise((resolve) => setTimeout(resolve, budgetMs)),
  ]);
};

export const compact = (n: number): string => new Intl.NumberFormat("en", { notation: "compact" }).format(n);
