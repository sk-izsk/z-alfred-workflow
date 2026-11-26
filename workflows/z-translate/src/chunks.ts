import type { Translation } from "./api.ts";
export const MAX_CHARACTERS = 50000;
export const CHUNK_CHARACTERS = 4500;
export const characterCount = (text: string): number => Array.from(text).length;
export const splitText = (text: string): string[] => {
  const chars = Array.from(text);
  if (chars.length > MAX_CHARACTERS) throw new Error("Enter up to 50,000 characters to translate.");
  const parts: string[] = [];
  let offset = 0;
  while (offset < chars.length) {
    let end = Math.min(offset + CHUNK_CHARACTERS, chars.length);
    if (end < chars.length) {
      const floor = offset + Math.floor(CHUNK_CHARACTERS / 2);
      let boundary = -1;
      for (let i = end - 1; i >= floor; i--)
        if (chars[i] === "\n") {
          boundary = i + 1;
          break;
        }
      if (boundary < 0)
        for (let i = end - 1; i >= floor; i--)
          if (/\s/u.test(chars[i]!)) {
            boundary = i + 1;
            break;
          }
      if (boundary > offset) end = boundary;
    }
    parts.push(chars.slice(offset, end).join(""));
    offset = end;
  }
  return parts;
};
export const combineParts = (parts: Translation[], original: string, to: string): Translation => {
  if (!parts.length) throw new Error("No translated parts available.");
  const sources = [...new Set(parts.map((p) => p.from).filter((p) => p && p !== "auto"))];
  return {
    text: parts.map((p) => p.text).join(""),
    original,
    to,
    from: sources.length === 1 ? sources[0]! : "mul",
    pronunciation: parts
      .map((p) => p.pronunciation)
      .filter(Boolean)
      .join("\n"),
    fetched: Math.min(...parts.map((p) => p.fetched)),
  };
};
