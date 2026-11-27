// LeetCode serves problem descriptions as HTML; Alfred's markdownarea shows Markdown. Converter
// settings are adapted from the Raycast LeetCode extension's utils.ts (MIT, see THIRD_PARTY_NOTICES.md).
import { NodeHtmlMarkdown, type TranslatorConfig } from "node-html-markdown";
import type { Problem } from "./api.ts";

// Markdown has no superscript or subscript, so write 10<sup>4</sup> as 10^4 and x<sub>i</sub> as x_i,
// parenthesize compound ones (2^(n - 1)), and leave ordinals (2<sup>nd</sup>) plain.
const scriptTranslator = (mark: string): TranslatorConfig => ({
  postprocess: ({ content }) => {
    const body = content.trim();
    if (!body || /^(st|nd|rd|th)$/.test(body)) return content;
    const text = /^-?\w+$/.test(body) ? `${mark}${body}` : `${mark}(${body})`;
    return content.replace(body, () => text);
  },
});
const scripts = { sup: scriptTranslator("^"), sub: scriptTranslator("_") };

const converter = new NodeHtmlMarkdown(
  {
    textReplace: [
      [/\\\[/g, "["],
      [/\\\]/g, "]"],
    ],
  },
  {
    // Code blocks drop the <strong> around LeetCode's "Input:"/"Output:" labels, which would
    // otherwise show as literal ** inside the fence.
    pre: ({ visitor }) => ({
      noEscape: true,
      preserveWhitespace: true,
      spaceIfRepeatingChar: true,
      childTranslators: visitor.instance.codeBlockTranslators,
      postprocess: ({ content, options: { codeFence } }) => `${codeFence}\n${content.trim()}\n${codeFence}`,
    }),
    code: ({ visitor }) => ({
      noEscape: true,
      spaceIfRepeatingChar: true,
      childTranslators: visitor.instance.codeBlockTranslators,
      postprocess: ({ content }) => {
        const longest = Math.max(0, ...(content.match(/`+/g) ?? []).map((run) => run.length));
        const fence = "`".repeat(longest + 1),
          pad = longest ? " " : "";
        return `${fence}${pad}${content}${pad}${fence}`;
      },
    }),
    ...scripts,
  },
  scripts,
);

export const PAID_NOTICE = "The problem is paid only, currently preview is not supported.";
export const htmlToMarkdown = (html: string): string => converter.translate(html);

export type PreviewOptions = { date?: string; stats: boolean; topics: boolean; rating?: number | null };

/** The preview, laid out like Raycast's: title, date/difficulty/likes, description, stats footer. */
export const problemMarkdown = (p: Problem, o: PreviewOptions): string => {
  const meta = [
    o.date && `**🗓️ Date**: ${o.date}`,
    o.stats && `**🧠 Difficulty**: ${p.difficulty}`,
    o.stats && `**👍 Likes**: ${p.likes}`,
    o.stats && `**👎 Dislikes**: ${p.dislikes}`,
    o.rating !== undefined && `**📈 Rating**: ${o.rating ?? "Unrated"}`,
  ].filter(Boolean);
  const topics = o.topics && p.topics.length ? `**🏷️ Topics**: ${p.topics.join(", ")}\n\n` : "";
  const body = p.paid || !p.content ? PAID_NOTICE : htmlToMarkdown(p.content);
  const footer =
    o.stats && p.stats
      ? `\n\n> **Accepted** ${p.stats.totalAccepted} | **Submissions** ${p.stats.totalSubmission} | **Accepted Rate** ${p.stats.acRate}`
      : "";
  return `# ${p.id}. ${p.title}\n\n${meta.length ? `${meta.join(" | ")}\n\n` : ""}${topics}${body}${footer}\n`;
};
