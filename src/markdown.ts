/**
 * Just enough Markdown → HTML for extension READMEs: headings, paragraphs, lists, code, quotes, images,
 * links, bold/italic. Raw HTML in the README (common: <p align="center"><img …>) is passed through.
 * ponytail: no tables/footnotes; add a real parser only if previews look broken in practice.
 */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const inline = (s: string): string =>
  s
    .replace(/`([^`]+)`/g, (_, c: string) => `<code>${esc(c)}</code>`)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, '<img alt="$1" src="$2">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");

export const markdownToHtml = (md: string): string => {
  const out: string[] = [];
  const lines = md.replace(/\r/g, "").split("\n");
  let para: string[] = [];
  let list: "ul" | "ol" | "" = "";
  // Like CommonMark: a line starting with an HTML tag opens a raw block that runs to the next blank line.
  let rawHtml = false;
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };
  const endList = () => {
    if (list) out.push(`</${list}>`);
    list = "";
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (rawHtml) {
      if (line.trim()) {
        out.push(line);
        continue;
      }
      rawHtml = false;
    }
    const fence = line.match(/^\s*(```|~~~)/);
    if (fence) {
      flush();
      endList();
      const code: string[] = [];
      while (++i < lines.length && !lines[i]!.trim().startsWith(fence[1]!)) code.push(lines[i]!);
      out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    const item = line.match(/^\s*([-*+]|\d+\.)\s+(.*)$/);
    if (heading) {
      flush();
      endList();
      out.push(`<h${heading[1]!.length}>${inline(heading[2]!)}</h${heading[1]!.length}>`);
    } else if (item) {
      flush();
      const kind = /\d/.test(item[1]!) ? "ol" : "ul";
      if (list !== kind) {
        endList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline(item[2]!)}</li>`);
    } else if (/^\s*>/.test(line)) {
      flush();
      endList();
      out.push(`<blockquote>${inline(line.replace(/^\s*>\s?/, ""))}</blockquote>`);
    } else if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      flush();
      endList();
      out.push("<hr>");
    } else if (/^\s*</.test(line)) {
      flush();
      endList();
      out.push(line); // raw HTML
      rawHtml = true;
    } else if (!line.trim()) {
      flush();
      endList();
    } else {
      endList();
      para.push(line.trim());
    }
  }
  flush();
  endList();
  return out.join("\n");
};
