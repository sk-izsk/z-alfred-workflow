// The extension preview as native Markdown (Alfred's markdownarea), with README images made local:
// that view shows local images (PNG, JPEG, GIF, WebP, SVG) but not web images, and not file paths
// containing spaces, so images are kept in a temp folder whose path has none.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type PreviewInfo = {
  name: string;
  publisher: string;
  description: string;
  version: string;
  installs?: string;
  /** A local icon file or an https URL. */
  icon?: string;
  /** Raw README Markdown. */
  readme: string;
  /** Resolves relative image links (an installed extension's folder, as a file URL). */
  base?: string;
};

const MAX_IMAGES = 15;
const MAX_BYTES = 5_000_000;
const TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
const EXTS = new Set(Object.values(TYPES));
export const imageDir = (): string => join(tmpdir(), "izsk-vscode-readme");

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
let fetcher: Fetch = (url, init) => fetch(url, init);
/** Tests replace the network. */
export const setFetcher = (f: Fetch): void => {
  fetcher = f;
};

// Images that failed (timeout, 404, wrong type) are skipped for a day, so they don't slow every preview.
const failedFile = () => join(imageDir(), "failed.json");
const failed = (): Record<string, number> => {
  try {
    return JSON.parse(readFileSync(failedFile(), "utf8"));
  } catch {
    // none yet
    return {};
  }
};
const markFailed = (href: string) => {
  const now = Date.now();
  const kept = Object.fromEntries(Object.entries(failed()).filter(([, at]) => now - at < 86_400_000));
  writeFileSync(failedFile(), JSON.stringify({ ...kept, [href]: now }));
};

/** A local, space-free copy of an image (file or https), or undefined when it can't be had. */
export const localImage = async (src: string, base?: string): Promise<string | undefined> => {
  let url: URL;
  try {
    url = new URL(src.trim(), base);
  } catch {
    // a relative link with no base
    return undefined;
  }
  if (!["file:", "https:", "http:"].includes(url.protocol)) return undefined;
  mkdirSync(imageDir(), { recursive: true });
  const key = createHash("sha256").update(url.href).digest("hex").slice(0, 24);
  for (const ext of EXTS)
    if (existsSync(join(imageDir(), `${key}.${ext}`))) return join(imageDir(), `${key}.${ext}`);
  try {
    if (url.protocol === "file:") {
      const path = fileURLToPath(url);
      const ext = extname(path).slice(1).toLowerCase().replace("jpeg", "jpg");
      if (!EXTS.has(ext) || !existsSync(path)) return undefined;
      copyFileSync(path, join(imageDir(), `${key}.${ext}`));
      return join(imageDir(), `${key}.${ext}`);
    }
    if (Date.now() - (failed()[url.href] ?? 0) < 86_400_000) return undefined;
    // A slow host drops its image rather than holding up the preview (first view only; cached after).
    const response = await fetcher(url.href, { signal: AbortSignal.timeout(3000) });
    const ext = TYPES[(response.headers.get("content-type") ?? "").split(";")[0]!.trim()];
    if (!response.ok || !ext || Number(response.headers.get("content-length")) > MAX_BYTES) {
      markFailed(url.href);
      return undefined;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_BYTES) {
      markFailed(url.href);
      return undefined;
    }
    writeFileSync(join(imageDir(), `${key}.${ext}`), bytes);
    return join(imageDir(), `${key}.${ext}`);
  } catch {
    // offline, timed out or unreadable: the image is left out (and skipped for a day if remote)
    if (url.protocol !== "file:") markFailed(url.href);
    return undefined;
  }
};

// ![alt](src "title") with the title in double or single quotes, or none.
const IMAGE = /!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;
const HTML_IMG = /<img\b[^>]*>/gi;
const attr = (tag: string, name: string) =>
  tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? "";

/**
 * README Markdown for the native view: HTML images become Markdown images, layout-only HTML tags
 * are dropped (their text stays), and every image points at a local copy or is removed.
 */
export const nativeReadme = async (readme: string, base?: string): Promise<string> => {
  let md = readme
    .replace(HTML_IMG, (tag) => (attr(tag, "src") ? `![${attr(tag, "alt")}](${attr(tag, "src")})` : ""))
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(
      /<\/?(p|div|a|span|center|picture|source|details|summary|table|tbody|thead|tr|td|th|sup|sub|b|i|strong|em|h[1-6])\b[^>]*>/gi,
      "",
    )
    // The native view can't draw an image inside a link (badge rows): keep just the image.
    .replace(/\[\s*(!\[[^\]]*\]\([^)]*\))\s*\]\([^)]*\)/g, "$1");
  const sources = [...new Set([...md.matchAll(IMAGE)].map((m) => m[2]!))].slice(0, MAX_IMAGES);
  const local = new Map(await Promise.all(sources.map(async (s) => [s, await localImage(s, base)] as const)));
  md = md.replace(IMAGE, (_, alt: string, src: string) => {
    const path = local.get(src);
    return path ? `![${alt}](${path})` : "";
  });
  // Links left empty by a dropped image, then extra blank lines.
  return md
    .replace(/\[\s*\]\([^)]*\)/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

export type Preview = { icon?: string; markdown: string };
/**
 * Name, publisher, version, installs, description and README as Markdown, plus the icon as a local
 * file for a native 56 pt image (Markdown can't size an image, so the icon stays out of it).
 */
export const previewMarkdown = async (p: PreviewInfo): Promise<Preview> => {
  const icon = p.icon
    ? await localImage(p.icon.startsWith("/") ? `file://${encodeURI(p.icon)}` : p.icon)
    : undefined;
  const meta = [p.publisher, `v${p.version}`, p.installs && `${p.installs} installs`]
    .filter(Boolean)
    .join(" · ");
  const header = [`# ${p.name}`, meta, p.description].filter(Boolean).join("\n\n");
  const body = p.readme ? await nativeReadme(p.readme, p.base) : "_No README._";
  return { icon, markdown: `${header}\n\n---\n\n${body}\n` };
};

/** README.md of an installed extension, whatever its capitalisation. */
export const localReadme = (dir: string): string => {
  try {
    const name = readdirSync(dir).find((f) => /^readme\.md$/i.test(f));
    return name ? readFileSync(join(dir, name), "utf8") : "";
  } catch {
    // no readable README
    return "";
  }
};
