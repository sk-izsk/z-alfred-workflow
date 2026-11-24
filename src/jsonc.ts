/**
 * Read and set ONE top-level string setting in a JSONC file (VS Code's settings.json) without
 * touching anything else: comments, formatting, nested `"[python]": {…}` blocks all stay as they are.
 */
type Span = { start: number; end: number; keyStart: number };

/** Finds the value span of a top-level `"key": "value"`. Skips strings and comments. */
const findTopLevel = (text: string, key: string): Span | undefined => {
  let depth = 0;
  let i = 0;
  const readString = (from: number): number => {
    let j = from + 1;
    while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
    return j + 1;
  };
  const skipSpace = (from: number): number => {
    let j = from;
    for (;;) {
      if (/\s/.test(text[j] ?? "")) j++;
      else if (text.startsWith("//", j))
        j = text.indexOf("\n", j) === -1 ? text.length : text.indexOf("\n", j);
      else if (text.startsWith("/*", j))
        j = text.indexOf("*/", j) === -1 ? text.length : text.indexOf("*/", j) + 2;
      else return j;
    }
  };
  while (i < text.length) {
    const c = text[i];
    if (c === "/" && (text[i + 1] === "/" || text[i + 1] === "*")) {
      i = skipSpace(i);
    } else if (c === '"') {
      const end = readString(i);
      if (depth === 1 && text.slice(i + 1, end - 1) === key) {
        const colon = skipSpace(end);
        if (text[colon] === ":") {
          const v = skipSpace(colon + 1);
          if (text[v] === '"') return { start: v, end: readString(v), keyStart: i };
        }
      }
      i = end;
    } else {
      if (c === "{" || c === "[") depth++;
      if (c === "}" || c === "]") depth--;
      i++;
    }
  }
  return undefined;
};

export const getSetting = (text: string, key: string): string | undefined => {
  const span = findTopLevel(text, key);
  return span ? (JSON.parse(text.slice(span.start, span.end)) as string) : undefined;
};

export const setSetting = (text: string, key: string, value: string): string => {
  const literal = JSON.stringify(value);
  const span = findTopLevel(text, key);
  if (span) return text.slice(0, span.start) + literal + text.slice(span.end);
  const open = text.indexOf("{");
  if (open === -1) return `{\n  ${JSON.stringify(key)}: ${literal}\n}\n`;
  const empty =
    text
      .slice(open + 1)
      .replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "")
      .trim() === "}";
  return `${text.slice(0, open + 1)}\n  ${JSON.stringify(key)}: ${literal}${empty ? "" : ","}${text.slice(open + 1)}`;
};

/** Remove a top-level `"key": "value"` (with its comma), e.g. to restore "no theme set". */
export const removeSetting = (text: string, key: string): string => {
  const span = findTopLevel(text, key);
  if (!span) return text;
  const after = text.slice(span.end).match(/^\s*,/);
  if (after)
    return text.slice(0, span.keyStart) + text.slice(span.end + after[0].length).replace(/^[ \t]*\n?/, "");
  // Last property: drop the comma before it instead.
  const before = text.slice(0, span.keyStart).replace(/,\s*$/, "");
  return before + text.slice(span.end);
};
