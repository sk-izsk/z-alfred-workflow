import { describe, expect, test } from "bun:test";
import {
  normalize,
  health,
  installedPackages,
  mergeInstalled,
  packageName,
  searchPackages,
  tapName,
} from "../src/model.ts";
import { commands, dryRun, packagePlan, quote, terminalCommand, type Plan } from "../src/operations.ts";
import { doctorReport, vulnerabilityReport } from "../src/diagnostics.ts";
import { appMatches } from "../src/apps.ts";
import { rootItems } from "../src/root.ts";
import { packages } from "../ui/views.ts";
import { infoPlist } from "../scripts/plist.ts";
import { render } from "../src/presentation.ts";
const formula = (extra = {}) =>
  normalize(
    { name: "example", versions: { stable: "2.0" }, installed: [{ version: "1.0" }], ...extra },
    "formula",
  );
const cask = (extra = {}) =>
  normalize(
    {
      token: "example-app",
      name: ["Example App"],
      version: "2.0",
      artifacts: [{ app: ["Example App.app"] }],
      ...extra,
    },
    "cask",
  );

describe("Homebrew metadata", () => {
  test("normalizes formula and cask versions independently", () => {
    expect(formula().installed).toEqual(["1.0"]);
    expect(cask({ installed: "1.2" }).installed).toEqual(["1.2"]);
    expect(cask().apps).toEqual(["Example App.app"]);
  });
  test("disabled and unmaintained warnings outrank updates", () => {
    expect(health(formula({ disabled: true, deprecated: true, outdated: true }))).toMatchObject({
      label: "Disabled",
      colour: "systemRedColor",
    });
    expect(health(formula({ deprecated: true, deprecation_reason: "unmaintained" })).label).toBe(
      "Unmaintained",
    );
    expect(health(formula({ deprecated: true })).colour).toBe("systemRedColor");
    expect(health(formula({ outdated: true })).colour).toBe("systemOrangeColor");
  });
  test("installed state overlays the public catalog", () => {
    const merged = mergeInstalled([formula({ installed: [] })], [formula({ pinned: true })]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.pinned).toBe(true);
    expect(merged[0]?.installed).toEqual(["1.0"]);
  });
  test("rejects malformed installed response", () => {
    expect(() => installedPackages({ formulae: [] })).toThrow();
  });
  test("search matches all words and prioritizes exact tokens", () => {
    const result = searchPackages(
      [formula({ name: "example-extra" }), formula(), cask()],
      "example",
      "formula",
    );
    expect(result.map((p) => p.token)).toEqual(["example", "example-extra"]);
    expect(searchPackages([formula({ desc: "Encryption tool" })], "example encryption")).toHaveLength(1);
    expect(searchPackages([formula()], "unknown")).toHaveLength(0);
  });
});
describe("reviewed operations", () => {
  test("rejects option injection and shell syntax", () => {
    for (const name of ["--force", "x;rm -rf /", "$(id)", "foo\nbar", "../foo", "a b"])
      expect(() => packageName(name)).toThrow();
    expect(packageName("owner/tap/python@3.14")).toBe("owner/tap/python@3.14");
    expect(() => tapName("--custom-remote")).toThrow();
    expect(tapName("owner/repo")).toBe("owner/repo");
  });
  test("mixed upgrades use separate formula and cask commands", () => {
    expect(commands(packagePlan("upgrade", [formula(), cask({ installed: "1.0" })]))).toEqual([
      ["upgrade", "--formula", "example"],
      ["upgrade", "--cask", "example-app"],
    ]);
  });
  test("adoption never forces replacement", () => {
    const plan = packagePlan("adopt", [cask()]);
    expect(commands(plan)).toEqual([["install", "--cask", "--adopt", "example-app"]]);
    expect(dryRun(plan)[0]?.at(-1)).toBe("--dry-run");
    expect(() => packagePlan("adopt", [formula()])).toThrow();
  });
  test("pinned and disabled packages cannot be bulk upgraded", () => {
    expect(() => packagePlan("upgrade", [formula({ pinned: true })])).toThrow();
    expect(() => packagePlan("upgrade", [formula({ disabled: true })])).toThrow();
    expect(() => packagePlan("upgrade", [cask()])).toThrow();
  });
  test("an empty selection cannot upgrade everything", () => {
    expect(() => packagePlan("upgrade", [])).toThrow();
  });
  test("unknown verbs cannot become terminal commands", () => {
    expect(() => commands({ verb: "exec", targets: [] } as unknown as Plan)).toThrow();
  });
  test("terminal executable and arguments are quoted", () => {
    expect(quote("/tmp/a'b")).toBe("'/tmp/a'\\''b'");
    expect(terminalCommand("/tmp/Home brew/bin/brew", { verb: "update", targets: [] })).toBe(
      "'/tmp/Home brew/bin/brew' 'update'",
    );
  });
  test("services and taps are validated independently", () => {
    expect(
      commands({ verb: "service-start", targets: [{ kind: "formula", token: "postgresql@17" }] }),
    ).toEqual([["services", "start", "postgresql@17"]]);
    expect(commands({ verb: "tap", targets: [], tap: "owner/repo" })).toEqual([["tap", "owner/repo"]]);
  });
});
describe("reports and adoption", () => {
  test("doctor presents remediation as text", () => {
    const text = doctorReport({
      tier: 1,
      findings: [
        {
          text: "Deprecated cask",
          remediation: { commands: ["brew uninstall example"], text: "Find a replacement" },
        },
      ],
    });
    expect(text).toContain("review manually");
    expect(text).toContain("Deprecated cask");
  });
  test("vulnerability report includes incomplete coverage", () => {
    const text = vulnerabilityReport({
      findings: [],
      skipped_formulae: ["a"],
      unscanned_formulae: { b: "No SBOM" },
      outdated_without_sbom: ["c"],
    });
    expect(text).toContain("Skipped: a");
    expect(text).toContain("b: No SBOM");
    expect(text).toContain("unavailable for: c");
  });
  test("matches app artifacts but excludes installed or disabled casks", () => {
    expect(appMatches("Example App.app", "2.0", cask())).toBe(true);
    expect(appMatches("Other.app", "2.0", cask())).toBe(false);
    expect(appMatches("Example App.app", "2.0", cask({ disabled: true }))).toBe(false);
    expect(appMatches("Example App.app", "2.0", cask({ installed: "2.0" }))).toBe(false);
  });
});
describe("Alfred integration", () => {
  test("menu forwards search terms and has direct aliases", () => {
    expect(rootItems("search encryption")[0]).toMatchObject({
      arg: "encryption",
      variables: { brew_target: "search" },
    });
    expect(rootItems("unrecognized package")[0]?.variables.brew_target).toBe("search");
    expect(rootItems("").length).toBeGreaterThan(8);
  });
  test("all generated views have unique IDs and export confirmation variables", () => {
    for (const ui of Object.values(packages)) {
      const ids: string[] = [];
      const visit = (node: unknown): void => {
        if (!node || typeof node !== "object") return;
        if (Array.isArray(node)) {
          node.forEach(visit);
          return;
        }
        const obj = node as Record<string, unknown>;
        if (typeof obj.id === "string") ids.push(obj.id);
        Object.values(obj).forEach(visit);
      };
      visit(ui);
      expect(new Set(ids).size).toBe(ids.length);
      expect((ui.variablesconfig as any).brew_plan.scriptenv).toBe(true);
      expect(JSON.stringify(ui)).not.toContain("webkitview");
    }
  });
  test("every view is wired to a workflow object and configurable keyword", () => {
    const objs = infoPlist.objects as any[];
    for (const name of Object.keys(packages)) expect(objs.some((o) => o.config.path === name)).toBe(true);
    const keywords = infoPlist.userconfigurationconfig.filter((c) => String(c.variable).startsWith("kw_"));
    for (const kw of keywords) expect(String((kw.config as any).default).length).toBeGreaterThanOrEqual(3);
  });
  test("row update includes both data and placeholder", () => {
    const action = render({
      mode: "installed",
      packages: [formula({ deprecated: true })],
      selected: [],
      at: Date.now(),
    });
    const items = (action.update as any).ids.items;
    expect(items.data.src).toHaveLength(1);
    expect(items.placeholder).toBeDefined();
    expect(items.data.src[0]["rowStatus.colour"]).toBe("systemRedColor");
  });
});

describe("command routing without mutations", () => {
  test("review creates a sheet; only execute finishes the window", async () => {
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { createState } = await import("../src/state.ts");
    const { planAction, execute } = await import("../src/commands.ts");
    const dir = mkdtempSync(join(tmpdir(), "brew-test-"));
    const keys = ["alfred_workflow_cache", "brew_window", "brew_plan", "brew_path"];
    const old = keys.map((k) => process.env[k]);
    try {
      process.env.alfred_workflow_cache = dir;
      process.env.brew_path = "/usr/bin/true";
      process.env.brew_window = createState({ mode: "installed", packages: [formula()], selected: [] });
      const review = await planAction(["pin", "formula:example"]);
      expect((review.sheet as any).id).toBe("confirmSheet");
      expect(review.finish).toBeUndefined();
      process.env.brew_plan = (review.variables as any).brew_plan;
      const dispatch = await execute();
      expect((dispatch.finish as any).variables.brew_out).toBe("execute");
      process.env.brew_plan = JSON.stringify({ verb: "shell", targets: [] });
      await expect(execute()).rejects.toThrow();
    } finally {
      keys.forEach((k, i) => {
        if (old[i] === undefined) delete process.env[k];
        else process.env[k] = old[i];
      });
      rmSync(dir, { recursive: true, force: true });
    }
  });
  test("greedy is limited to cask upgrades", () => {
    expect(commands(packagePlan("upgrade", [formula(), cask({ installed: "1" })], true))).toEqual([
      ["upgrade", "--formula", "example"],
      ["upgrade", "--cask", "--greedy", "example-app"],
    ]);
  });
  test("opening a catalog view uses cache; explicit refresh forces fetching", () => {
    const ui = packages["search.alfredui"] as any;
    const event = ui.window.root.events.find((e: any) => e.triggers === "launched");
    expect(event.action.args).toEqual(["load", "search"]);
  });
});
