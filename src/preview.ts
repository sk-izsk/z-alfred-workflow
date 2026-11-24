import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { markdownToHtml } from "./markdown.ts";

export type PreviewInfo = {
  name: string;
  publisher: string;
  description: string;
  version: string;
  installs?: string;
  icon?: string;
  /** Raw README Markdown. */
  readme: string;
  /** Resolves relative image links (an extension folder, or the repo). */
  base?: string;
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A self-contained page for the preview sheet: header + README, light/dark like the system. */
export const previewHtml = (p: PreviewInfo): string => `<!doctype html><html><head><meta charset="utf-8">
${p.base ? `<base href="${esc(p.base)}">` : ""}
<style>
:root { color-scheme: light dark; --dim: #8888; }
body { font: 13px -apple-system, system-ui; margin: 0; padding: 18px 22px 40px; line-height: 1.5; background: transparent; }
header { display: flex; gap: 14px; align-items: center; padding-bottom: 14px; border-bottom: 1px solid var(--dim); margin-bottom: 8px; }
header img { width: 56px; height: 56px; border-radius: 10px; }
h1.title { font-size: 20px; margin: 0; } .meta { opacity: .7; } .desc { margin-top: 2px; }
img { max-width: 100%; height: auto; } pre { background: #8881; padding: 10px; border-radius: 6px; overflow: auto; }
code { font: 12px ui-monospace, Menlo; } a { color: AccentColor; } table { border-collapse: collapse; }
h1, h2, h3 { margin: 1.2em 0 .4em; } blockquote { border-left: 3px solid var(--dim); margin: 0; padding-left: 10px; opacity: .85; }
</style></head><body>
<header>${p.icon ? `<img src="${esc(p.icon)}">` : ""}<div>
<h1 class="title">${esc(p.name)}</h1>
<div class="meta">${esc(p.publisher)} · v${esc(p.version)}${p.installs ? ` · ${esc(p.installs)} installs` : ""}</div>
${p.description ? `<div class="desc">${esc(p.description)}</div>` : ""}
</div></header>
${p.readme ? markdownToHtml(p.readme) : "<p><em>No README.</em></p>"}
</body></html>`;

/** README.md of an installed extension, whatever its capitalisation. */
export const localReadme = (dir: string): string => {
  try {
    const name = readdirSync(dir).find((f) => /^readme\.md$/i.test(f));
    return name ? readFileSync(join(dir, name), "utf8") : "";
  } catch {
    return "";
  }
};
