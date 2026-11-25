// Arithmetic only: never evaluate JavaScript supplied through an Alfred query.
export const calculate = (input: string): number => {
  if (input.length > 200 || /[^\d\s.()+*/^%-]/.test(input))
    throw new Error("Use numbers and arithmetic operators only.");
  const tokens = input.match(/\d*\.\d+|\d+\.?\d*|[^\s]/g) || [];
  let at = 0,
    depth = 0;
  const primary = (): number => {
    if (++depth > 40) throw new Error("Expression is too deeply nested.");
    let result: number;
    if (tokens[at] === "(") {
      at++;
      result = sum();
      if (tokens[at++] !== ")") throw new Error("Close the parentheses.");
    } else {
      const token = tokens[at++];
      if (!token || !/^\d*\.?\d+(?:\.\d*)?$/.test(token)) throw new Error("Enter a valid amount.");
      result = Number(token);
    }
    while (tokens[at] === "%") {
      at++;
      result /= 100;
    }
    depth--;
    return result;
  };
  const power = (): number => {
    const left = primary();
    if (tokens[at] === "^") {
      at++;
      return left ** unary();
    }
    return left;
  };
  const unary = (): number => {
    if (tokens[at] === "+" || tokens[at] === "-") {
      const sign = tokens[at++];
      if (++depth > 40) throw new Error("Expression is too deeply nested.");
      const n = unary();
      depth--;
      return sign === "-" ? -n : n;
    }
    return power();
  };
  const product = (): number => {
    let n = unary();
    while (tokens[at] === "*" || tokens[at] === "/") {
      const op = tokens[at++],
        r = unary();
      if (op === "/" && r === 0) throw new Error("Cannot divide by zero.");
      n = op === "*" ? n * r : n / r;
    }
    return n;
  };
  const sum = (): number => {
    let n = product();
    while (tokens[at] === "+" || tokens[at] === "-") {
      const op = tokens[at++],
        r = product();
      n = op === "+" ? n + r : n - r;
    }
    return n;
  };
  const result = sum();
  if (at !== tokens.length || !Number.isFinite(result) || Math.abs(result) > 1e15)
    throw new Error("Amount is invalid or too large.");
  return result;
};
export const validDate = (input: string): string => {
  const m = input.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!m) throw new Error("Use YYYY-MM-DD for the rate date.");
  const date = `${m[1]}-${m[2]!.padStart(2, "0")}-${m[3]!.padStart(2, "0")}`;
  if (new Date(`${date}T12:00Z`).toISOString().slice(0, 10) !== date)
    throw new Error("Invalid calendar date.");
  if (date > new Date().toISOString().slice(0, 10)) throw new Error("Choose today or a past date.");
  return date;
};
export const parseQuery = (text: string): { amount: number; filter: string; date: string } => {
  if (text.length > 300) throw new Error("Query is too long.");
  const dateMatch = text.match(/\s+at\s+(\S+)\s*$/i),
    date = dateMatch ? validDate(dateMatch[1]!) : "";
  const query = dateMatch ? text.slice(0, dateMatch.index) : text;
  const prefix = query.match(/^[\d\s.()+*/^%-]+/),
    expression = prefix?.[0].trim() || "";
  return {
    amount: expression ? calculate(expression) : 1,
    filter: query
      .slice(prefix?.[0].length || 0)
      .trim()
      .replace(/^(?:in|to)\s+/i, "")
      .toLowerCase(),
    date,
  };
};
