import { expect, test } from "bun:test";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { transform } from "../src/transforms.ts";
import { create } from "../src/state.ts";
import { run, copyOutput } from "../ui/window.ts";
test("JSON, Base64, hashing, cases and time transforms are local and Unicode aware", () => {
  expect(transform("json-sort", '{"z":1,"a":{"y":2,"b":3}}')).toContain('"b": 3');
  expect(transform("base64-decode", transform("base64", "বাংলা 🙂"))).toBe("বাংলা 🙂");
  expect(() => transform("base64-decode", "@@")).toThrow();
  expect(transform("sha256", "abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  expect(transform("snake", "myHTTPServer")).toBe("my_http_server");
  expect(transform("unix", "0")).toBe("1970-01-01T00:00:00.000Z");
});
const b = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
test("JWT decode is explicitly unverified and query parsing preserves duplicate/prototype keys", () => {
  expect(transform("jwt", `${b({ alg: "none" })}.${b({ sub: "test" })}.sig`)).toContain("NOT verified");
  expect(JSON.parse(transform("query", "a=1&a=2&__proto__=safe"))).toEqual({
    a: ["1", "2"],
    __proto__: ["safe"],
  });
  expect(() => transform("upper", "x".repeat(50001))).toThrow("Input limit");
});
test("session metadata does not persist editor text and actions keep it out of argv", () => {
  const dir = mkdtempSync(join(tmpdir(), "dev-utils-test-")),
    prior = process.env.alfred_workflow_cache;
  process.env.alfred_workflow_cache = dir;
  try {
    const s = create("");
    const data = JSON.parse(readFileSync(join(dir, `window-${s.id}.json`), "utf8"));
    expect(Object.keys(data)).toEqual(["id", "query", "selected", "returnTo", "at"]);
    expect(run("transform").args).not.toContain("{value:input.text}");
    expect(run("transform").variables.devutils_text).toBe("{value:input.text}");
    expect(copyOutput().src.copy.src).toBe("{var:devutils_copy_value}");
  } finally {
    if (prior === undefined) delete process.env.alfred_workflow_cache;
    else process.env.alfred_workflow_cache = prior;
    rmSync(dir, { recursive: true, force: true });
  }
});
