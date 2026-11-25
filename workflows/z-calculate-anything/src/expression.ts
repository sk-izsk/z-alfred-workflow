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
