import { packageName, tapName, type Kind, type Package } from "./model.ts";

export type Verb =
  | "install"
  | "uninstall"
  | "upgrade"
  | "pin"
  | "unpin"
  | "adopt"
  | "cleanup"
  | "update"
  | "tap"
  | "untap"
  | "service-start"
  | "service-stop"
  | "service-restart";
export type Target = { kind: Kind; token: string };
export type Plan = { verb: Verb; targets: Target[]; greedy?: boolean; tap?: string };
export const commands = (plan: Plan): string[][] => {
  if (!plan || !Array.isArray(plan.targets)) throw new Error("Invalid Homebrew action.");
  const verbs: string[] = [
    "install",
    "uninstall",
    "upgrade",
    "pin",
    "unpin",
    "adopt",
    "cleanup",
    "update",
    "tap",
    "untap",
    "service-start",
    "service-stop",
    "service-restart",
  ];
  if (!verbs.includes(plan.verb)) throw new Error("Unsupported Homebrew action.");
  const targets = plan.targets.map((t) => {
    if (t.kind !== "formula" && t.kind !== "cask") throw new Error("Invalid package type.");
    return { ...t, token: packageName(t.token) };
  });
  if (plan.verb === "cleanup" || plan.verb === "update") return [[plan.verb]];
  if (plan.verb === "tap" || plan.verb === "untap") return [[plan.verb, tapName(plan.tap || "")]];
  if (!targets.length) throw new Error("Choose at least one package.");
  if (plan.verb.startsWith("service-")) {
    if (targets.length !== 1 || targets[0]!.kind !== "formula") throw new Error("Choose one service.");
    return [["services", plan.verb.slice(8), targets[0]!.token]];
  }
  if (plan.verb === "adopt" && targets.some((t) => t.kind !== "cask"))
    throw new Error("Only casks can adopt apps.");
  return (["formula", "cask"] as const).flatMap((kind) => {
    const names = targets.filter((t) => t.kind === kind).map((t) => t.token);
    if (!names.length) return [];
    const verb = plan.verb === "adopt" ? "install" : plan.verb;
    return [
      [
        verb,
        `--${kind}`,
        ...(plan.verb === "adopt" ? ["--adopt"] : []),
        ...(plan.verb === "upgrade" && kind === "cask" && plan.greedy ? ["--greedy"] : []),
        ...names,
      ],
    ];
  });
};
export const packagePlan = (verb: Verb, packages: Package[], greedy = false): Plan => {
  if (packages.some((p) => p.pinned) && ["upgrade", "uninstall"].includes(verb))
    throw new Error("Unpin the selected package before upgrading or uninstalling it.");
  if (packages.some((p) => p.disabled) && ["install", "upgrade", "adopt"].includes(verb))
    throw new Error("This package is disabled by Homebrew. Check its details for a replacement.");
  if (verb === "install" && packages.some((p) => p.installed.length))
    throw new Error("This package is already installed.");
  if (["upgrade", "uninstall", "pin", "unpin"].includes(verb) && packages.some((p) => !p.installed.length))
    throw new Error("Choose an installed package.");
  const plan = { verb, targets: packages.map((p) => ({ kind: p.kind, token: p.token })), greedy };
  commands(plan);
  return plan;
};
export const quote = (value: string): string => `'${value.replace(/'/g, "'\\''")}'`;
export const terminalCommand = (brew: string, plan: Plan): string =>
  commands(plan)
    .map((args) => [brew, ...args].map(quote).join(" "))
    .join(" && ");
export const dryRun = (plan: Plan): string[][] => {
  if (!["install", "upgrade", "adopt", "cleanup"].includes(plan.verb))
    throw new Error("This action has no dry-run preview.");
  return commands(plan).map((args) => [...args, "--dry-run"]);
};
