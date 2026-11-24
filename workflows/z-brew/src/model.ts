export type Kind = "formula" | "cask";
export type Package = {
  id: string;
  kind: Kind;
  token: string;
  name: string;
  desc: string;
  version: string;
  installed: string[];
  outdated: boolean;
  pinned: boolean;
  deprecated: boolean;
  disabled: boolean;
  reason: string;
  homepage: string;
  tap: string;
  license: string;
  caveats: string;
  dependencies: string[];
  apps: string[];
  autoUpdates: boolean;
  installedTime: number;
};
export const packageName = (name: string): string => {
  if (!/^[a-z0-9][a-z0-9+_.@-]*(\/[a-z0-9][a-z0-9+_.@-]*){0,2}$/i.test(name))
    throw new Error("Invalid Homebrew package name.");
  return name;
};
export const tapName = (name: string): string => {
  if (!/^[a-z0-9][a-z0-9_.-]*\/[a-z0-9][a-z0-9_.-]*$/i.test(name))
    throw new Error("Use a tap name such as owner/repository.");
  return name;
};
const text = (value: unknown): string => (typeof value === "string" ? value : "");
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
export const normalize = (raw: Record<string, any>, kind: Kind): Package => {
  const token = packageName(
    text(kind === "formula" ? raw.full_name || raw.name : raw.full_token || raw.token),
  );
  const installed =
    kind === "formula"
      ? Array.isArray(raw.installed)
        ? raw.installed.map((i: any) => text(i?.version)).filter(Boolean)
        : []
      : typeof raw.installed === "string"
        ? [raw.installed]
        : strings(raw.installed);
  const artifacts = Array.isArray(raw.artifacts) ? raw.artifacts : [];
  return {
    id: `${kind}:${token}`,
    token,
    kind,
    name: kind === "cask" ? strings(raw.name)[0] || token : text(raw.name) || token,
    desc: text(raw.desc),
    version: kind === "formula" ? text(raw.versions?.stable) : text(raw.version),
    installed,
    outdated: raw.outdated === true,
    pinned: raw.pinned === true,
    deprecated: raw.deprecated === true,
    disabled: raw.disabled === true,
    reason: text(raw.disable_reason || raw.deprecation_reason).replace(/_/g, " "),
    homepage: text(raw.homepage),
    tap: text(raw.tap),
    license: text(raw.license),
    caveats: text(raw.caveats),
    dependencies: strings(raw.dependencies || raw.depends_on?.formula),
    apps: artifacts.flatMap((artifact: any) => strings(artifact?.app)),
    autoUpdates: raw.auto_updates === true,
    installedTime: Number(raw.installed_time || raw.installed?.[0]?.time || 0),
  };
};
export const installedPackages = (value: unknown): Package[] => {
  if (!value || typeof value !== "object") throw new Error("Unexpected Homebrew installed-package response.");
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.formulae) || !Array.isArray(raw.casks))
    throw new Error("Unexpected Homebrew installed-package response.");
  return [...raw.formulae.map((p) => normalize(p, "formula")), ...raw.casks.map((p) => normalize(p, "cask"))];
};
export const mergeInstalled = (catalog: Package[], local: Package[]): Package[] => {
  const found = new Map(catalog.map((p) => [p.id, p]));
  for (const p of local) found.set(p.id, { ...(found.get(p.id) || p), ...p });
  return [...found.values()];
};
export const health = (p: Package): { label: string; colour: string; icon: string } => {
  if (p.disabled) return { label: "Disabled", colour: "systemRedColor", icon: "exclamationmark.octagon" };
  if (p.deprecated)
    return {
      label: /unmaintained|discontinued|archived/.test(p.reason) ? "Unmaintained" : "Deprecated",
      colour: "systemRedColor",
      icon: "exclamationmark.triangle",
    };
  if (p.outdated) return { label: "Outdated", colour: "systemOrangeColor", icon: "arrow.up.circle" };
  if (p.installed.length) return { label: "Installed", colour: "systemGreenColor", icon: "checkmark.circle" };
  return { label: "", colour: "secondaryLabelColor", icon: "circle" };
};
export const searchPackages = (packages: Package[], query: string, kind = "all", limit = 200): Package[] => {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const q = query.trim().toLowerCase();
  const rank = (p: Package) =>
    p.token.toLowerCase() === q ? 0 : p.token.toLowerCase().startsWith(q) ? 1 : 2;
  return packages
    .filter(
      (p) =>
        (kind === "all" || p.kind === kind) &&
        words.every((w) => `${p.token} ${p.name} ${p.desc}`.toLowerCase().includes(w)),
    )
    .toSorted(
      (a, b) => rank(a) - rank(b) || Number(b.pinned) - Number(a.pinned) || a.token.localeCompare(b.token),
    )
    .slice(0, limit);
};
export const packageDetails = (p: Package): [string, string][] => [
  ["Description", p.desc],
  ["Status", [health(p).label, p.reason].filter(Boolean).join(" — ") || "Available"],
  ["Installed", p.installed.join(", ") || "Not installed"],
  ["Available version", p.version],
  ["Tap", p.tap],
  ["License", p.license || "Not specified"],
  ["Homepage", p.homepage],
  ["Dependencies", p.dependencies.join(", ") || "None"],
  ["Caveats", p.caveats || "None"],
  ["Pinned", p.pinned ? "Yes — excluded from upgrades" : "No"],
  ...(p.kind === "cask" ? [["Auto updates", p.autoUpdates ? "Yes" : "No"] as [string, string]] : []),
];
