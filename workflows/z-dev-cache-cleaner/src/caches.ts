import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";
import { existsSync, lstatSync, realpathSync, readdirSync } from "node:fs";
import { str } from "./env.ts";
const execute = promisify(execFile);
export type Cache = {
  id: string;
  name: string;
  path: string;
  category: string;
  risk: "Safe" | "Review";
  bytes: number;
  device: number;
  inode: number;
  kind: "known" | "artifact" | "simulator" | "command";
  note: string;
  error: string;
  sourcePath?: string;
  action?: string;
  available?: boolean;
  context?: string;
  simulatorIDs?: string[];
};
type Spec = {
  name: string;
  path: string;
  category: string;
  risk: "Safe" | "Review";
  note: string;
  action?: string;
  showEmpty?: boolean;
  locationError?: string;
};
const categories = {
  packages: "Package Manager Caches",
  xcode: "Xcode & iOS",
  languages: "Language Caches",
  system: "System Caches & Logs",
  projects: "Build Artifacts & Dependencies",
  containers: "Containers",
};
export const tool = (name: string): string => {
  let versions: string[] = [];
  try {
    versions = readdirSync(join(homedir(), ".nvm/versions/node"))
      .toSorted((a, b) => b.localeCompare(a, undefined, { numeric: true }))
      .map((v) => join(homedir(), ".nvm/versions/node", v, "bin"));
  } catch {}
  const dirs = [
    "/opt/homebrew/bin",
    "/usr/local/bin",
    join(homedir(), ".local/bin"),
    join(homedir(), ".bun/bin"),
    ...versions,
    "/usr/bin",
  ];
  return dirs.map((d) => join(d, name)).find((p) => existsSync(p)) || "";
};
const run = async (bin: string, args: string[], timeout = 8000): Promise<string> =>
  (
    await execute(bin, args, {
      encoding: "utf8",
      timeout,
      maxBuffer: 4e6,
      env: {
        ...process.env,
        PATH: [
          dirname(bin),
          dirname(str("node_path", "/opt/homebrew/bin/node")),
          "/opt/homebrew/bin",
          "/usr/local/bin",
          "/usr/bin",
          "/bin",
          "/usr/sbin",
          "/sbin",
        ].join(":"),
        HOMEBREW_NO_AUTO_UPDATE: "1",
      },
    })
  ).stdout;
const staticSpecs = (): Spec[] =>
  [
    [
      "npm Cache",
      ".npm",
      categories.packages,
      "Safe",
      "Downloaded npm packages; npm cleans its own cache. Logs/other files may be retained.",
      "npm",
    ],
    [
      "Yarn Cache",
      "Library/Caches/Yarn",
      categories.packages,
      "Safe",
      "Downloaded Yarn packages; future installs download again.",
      "yarn",
    ],
    [
      "pnpm Store",
      "Library/pnpm/store",
      categories.packages,
      "Safe",
      "pnpm prunes unreferenced packages; active store content remains.",
      "pnpm",
    ],
    [
      "Homebrew Cache",
      "Library/Caches/Homebrew",
      categories.packages,
      "Safe",
      "Homebrew removes cached downloads and old installed versions using its cleanup command.",
      "brew",
    ],
    [
      "pip Cache",
      "Library/Caches/pip",
      categories.packages,
      "Safe",
      "Downloaded Python packages and wheels; re-download on demand.",
      "pip3",
    ],
    [
      "CocoaPods Cache",
      "Library/Caches/CocoaPods",
      categories.packages,
      "Safe",
      "Downloaded pod archives; re-download on demand.",
    ],
    [
      "Composer Cache",
      "Library/Caches/composer",
      categories.packages,
      "Safe",
      "Downloaded PHP packages; re-download on demand.",
    ],
    [
      "Xcode DerivedData",
      "Library/Developer/Xcode/DerivedData",
      categories.xcode,
      "Review",
      "Build products and indexes; stop active Xcode builds first.",
    ],
    [
      "Xcode Archives",
      "Library/Developer/Xcode/Archives",
      categories.xcode,
      "Review",
      "Signed builds and dSYMs may be irreplaceable; back up before cleaning.",
    ],
    [
      "iOS Device Support",
      "Library/Developer/Xcode/iOS DeviceSupport",
      categories.xcode,
      "Review",
      "Device debugging symbols; Xcode may download them again when a device connects.",
    ],
    [
      "watchOS Device Support",
      "Library/Developer/Xcode/watchOS DeviceSupport",
      categories.xcode,
      "Review",
      "Watch debugging symbols; Xcode may download them again.",
    ],
    [
      "tvOS Device Support",
      "Library/Developer/Xcode/tvOS DeviceSupport",
      categories.xcode,
      "Review",
      "TV debugging symbols; Xcode may download them again.",
    ],
    [
      "Simulator Caches",
      "Library/Developer/CoreSimulator/Caches",
      categories.xcode,
      "Review",
      "CoreSimulator caches only; installed devices and runtime volumes are not removed.",
    ],
    [
      "Android Download Cache",
      ".android/cache",
      categories.xcode,
      "Safe",
      "Android SDK/emulator download cache; downloads again when required.",
    ],
    [
      "Swift Package Manager",
      "Library/Caches/org.swift.swiftpm",
      categories.languages,
      "Safe",
      "Swift dependency cache; fetches packages again.",
    ],
    [
      "Gradle Cache",
      ".gradle/caches",
      categories.languages,
      "Review",
      "Gradle dependency/build caches; stop builds before cleaning.",
    ],
    [
      "Maven Local Repository",
      ".m2/repository",
      categories.languages,
      "Review",
      "May include locally published artifacts that cannot be downloaded again.",
    ],
    [
      "Cargo Registry",
      ".cargo/registry",
      categories.languages,
      "Review",
      "Rust package sources and archives; stop active Cargo builds first.",
    ],
    [
      "Go Module Cache",
      "go/pkg/mod",
      categories.languages,
      "Safe",
      "Downloaded Go modules; Go cleans its managed module cache.",
      "go",
    ],
    [
      "Go Build Cache",
      "Library/Caches/go-build",
      categories.languages,
      "Safe",
      "Compiled Go build cache; recompiles automatically.",
    ],
    [
      "Ruby Gems",
      ".gem",
      categories.languages,
      "Review",
      "gem cleanup removes old gem versions, not the entire gem directory.",
      "gem",
    ],
    [
      "uv Cache",
      ".cache/uv",
      categories.languages,
      "Safe",
      "Downloaded Python packages and build cache; downloads again.",
    ],
    [
      "User Log Files",
      "Library/Logs",
      categories.system,
      "Review",
      "Application logs; close affected apps before permanent removal.",
    ],
  ].map(([name, path, category, risk, note, action]) => ({
    name: name!,
    path: join(homedir(), path!),
    category: category!,
    risk: risk as "Safe" | "Review",
    note: note!,
    action,
  }));
let discovered: Promise<Spec[]> | undefined;
const specifications = (): Promise<Spec[]> =>
  (discovered ??= (async () => {
    const specs = staticSpecs();
    await Promise.all(
      specs
        .filter((s) => s.action)
        .map(async (s) => {
          const bin = tool(s.action!);
          s.showEmpty = !!bin;
          if (!bin) return;
          const args: Record<string, string[]> = {
            npm: ["config", "get", "cache"],
            yarn: ["cache", "dir"],
            pnpm: ["store", "path"],
            brew: ["--cache"],
            pip3: ["cache", "dir"],
            go: ["env", "GOMODCACHE"],
          };
          if (!args[s.action!]) return;
          try {
            const text = (await run(bin, args[s.action!]!))
              .trim()
              .split("\n")
              .find((x) => x.startsWith("/"));
            if (!text) throw new Error("No configured cache location");
            s.path = resolve(text);
          } catch {
            s.locationError =
              "Configured cache location could not be verified; cleanup is disabled. The default folder is shown for inspection only.";
          }
        }),
    );
    const base = join(homedir(), "Library/Caches");
    try {
      for (const item of readdirSync(base, { withFileTypes: true })) {
        if (!item.isDirectory() && !item.isSymbolicLink()) continue;
        if (/^(com\.apple\.|CloudKit|SiriTTS)/.test(item.name)) continue;
        const path = join(base, item.name);
        if (specs.some((s) => s.path === path)) continue;
        specs.push({
          name: `${item.name} Cache`,
          path,
          category: categories.system,
          risk: "Review",
          note: "Application cache; close the corresponding app before cleaning.",
        });
      }
    } catch {}
    const avd = join(homedir(), ".android/avd");
    try {
      for (const item of readdirSync(avd, { withFileTypes: true })) {
        if (item.isDirectory() && item.name.endsWith(".avd"))
          specs.push({
            name: `Android Snapshots · ${item.name.slice(0, -4)}`,
            path: join(avd, item.name, "snapshots"),
            category: categories.xcode,
            risk: "Review",
            note: "Deletes saved emulator snapshots/Quick Boot state, retaining the AVD and its application data.",
          });
      }
    } catch {}
    return specs;
  })());
const artifacts = new Set([
  "node_modules",
  ".next",
  ".nuxt",
  ".turbo",
  ".parcel-cache",
  ".svelte-kit",
  ".angular",
  ".expo",
  "__pycache__",
  ".venv",
  ".build",
  ".gradle",
  "coverage",
  ".dart_tool",
]);
export const roots = (): string[] =>
  str("project_roots", "~/Projects")
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => resolve(x.replace(/^~(?=\/|$)/, homedir())))
    .filter((x) => x !== "/" && x !== homedir());
const age = (): number => Math.max(1, Math.min(365, Number(str("artifact_days", "30")) || 30)) * 86400000;
export const bytes = (n: number): string => {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1024 && i < 4) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
};
const protectedRoot = (path: string): boolean =>
  [
    "/",
    homedir(),
    join(homedir(), "Library"),
    join(homedir(), "Library/Caches"),
    "/Volumes",
    "/Applications",
    "/Library",
  ].includes(path) || /^\/Volumes\/[^/]+$/.test(path);
const entry = (spec: Spec, kind: Cache["kind"] = "known"): Cache | null => {
  try {
    const path = realpathSync(spec.path),
      stat = lstatSync(path);
    if (!stat.isDirectory() || protectedRoot(path)) return null;
    return {
      id: spec.path,
      name: spec.name,
      path,
      sourcePath: spec.path,
      category: spec.category,
      risk: spec.risk,
      kind,
      note: spec.note,
      bytes: 0,
      device: stat.dev,
      inode: stat.ino,
      error: "",
      action: spec.action,
      available: !spec.locationError && (spec.action ? !!tool(spec.action) : true),
      context: spec.locationError,
    };
  } catch {
    return spec.showEmpty
      ? {
          id: spec.path,
          name: spec.name,
          path: spec.path,
          sourcePath: spec.path,
          category: spec.category,
          risk: spec.risk,
          kind,
          note: spec.note,
          bytes: 0,
          device: 0,
          inode: 0,
          error: "",
          action: spec.action,
          available: false,
          context: "Cache folder does not exist; nothing to clean.",
        }
      : null;
  }
};
export type Simulator = { udid: string; isAvailable?: boolean; availability?: string; dataPath?: string };
export const simulatorDevices = (raw: any): Simulator[] =>
  Object.values(raw?.devices || {})
    .flatMap((v) => (Array.isArray(v) ? v : []))
    .filter((v) => /^[a-f0-9-]{36}$/i.test(v.udid));
export const unavailable = (d: Simulator): boolean =>
  d.isAvailable === false || /unavailable/i.test(d.availability || "");
export const checkSimulators = (ids: string[], devices: Simulator[]): void => {
  if (!ids.length || ids.some((id) => !devices.some((d) => d.udid === id && unavailable(d))))
    throw new Error("Simulator availability changed. Scan and review again.");
};
const simulators = async (): Promise<Cache | null> => {
  if (!existsSync("/usr/bin/xcrun")) return null;
  try {
    const devices = simulatorDevices(
        JSON.parse(await run("/usr/bin/xcrun", ["simctl", "list", "devices", "--json"], 15000)),
      ),
      old = devices.filter(unavailable),
      path = join(homedir(), "Library/Developer/CoreSimulator/Devices");
    let total = 0;
    for (const d of old) {
      const data = d.dataPath || join(path, d.udid, "data"),
        root = dirname(data);
      if (existsSync(root)) {
        const out = await run("/usr/bin/du", ["-sk", root]);
        total += (Number(out.match(/^\s*(\d+)/)?.[1]) || 0) * 1024;
      }
    }
    return {
      id: "simulators-unavailable",
      name: "Simulators (unavailable)",
      path,
      category: categories.xcode,
      risk: "Review",
      kind: "simulator",
      note: "Deletes only the unavailable iOS/watchOS/tvOS/visionOS devices captured in this review via simctl. Available devices and installed runtimes remain.",
      bytes: total,
      device: 0,
      inode: 0,
      error: "",
      available: old.length > 0,
      simulatorIDs: old.map((d) => d.udid),
      context: `${devices.length} devices · ${old.length} unavailable; size counts only unavailable device data.`,
    };
  } catch {
    return null;
  }
};
export const cleanupArgs = (action: string): string[] => {
  const map: Record<string, string[]> = {
    npm: ["cache", "clean", "--force"],
    yarn: ["cache", "clean"],
    pnpm: ["store", "prune"],
    brew: ["cleanup", "--prune=0"],
    pip3: ["cache", "purge"],
    go: ["clean", "-modcache"],
    gem: ["cleanup"],
    "docker-images": ["image", "prune", "-f"],
    "docker-containers": ["container", "prune", "-f"],
    "docker-volumes": ["volume", "prune", "-f"],
    "docker-build": ["builder", "prune", "-f"],
  };
  const args = map[action];
  if (!args) throw new Error("Unsupported cleanup action.");
  return args;
};
const quote = (value: string): string => "'" + value.replace(/'/g, "'\\''") + "'";
export const cleanupCommand = (e: Cache): string =>
  e.kind === "simulator"
    ? `xcrun simctl delete ${(e.simulatorIDs || []).map(quote).join(" ") || "<unavailable-device-IDs>"}`
    : e.action
      ? `${e.action.startsWith("docker-") ? "docker" : e.action} ${cleanupArgs(e.action).join(" ")}`
      : `rm -rf -- ${quote(e.path)}`;
const docker = async (): Promise<Cache[]> => {
  const bin = tool("docker");
  if (!bin) return [];
  try {
    const text = await run(bin, ["system", "df", "--format", "{{json .}}"]);
    return text
      .trim()
      .split("\n")
      .flatMap((line) => {
        const d = JSON.parse(line),
          type = String(d.Type || ""),
          action = /image/i.test(type)
            ? "docker-images"
            : /container/i.test(type)
              ? "docker-containers"
              : /volume/i.test(type)
                ? "docker-volumes"
                : /build/i.test(type)
                  ? "docker-build"
                  : "";
        if (!action) return [];
        const m = String(d.Reclaimable || "").match(/^([\d.]+)\s*([kMGT]?B)/i),
          multipliers: Record<string, number> = { B: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12 };
        return [
          {
            id: action,
            name: `Docker ${type} (reclaimable)`,
            path: bin,
            category: categories.containers,
            risk: "Review" as const,
            kind: "command" as const,
            note:
              action === "docker-volumes"
                ? "Unused volumes can contain databases and irreplaceable data. Inspect Docker storage before pruning."
                : "Docker prunes unused resources at execution time; estimates may differ from actual reclaimed storage.",
            bytes: m ? Number(m[1]) * multipliers[m[2]!.toUpperCase()]! : 0,
            device: 0,
            inode: 0,
            error: "",
            action,
            available: true,
          },
        ];
      });
  } catch {
    return [];
  }
};
export const scan = async (): Promise<{ rows: Cache[]; limited: boolean }> => {
  const rows: Cache[] = [];
  for (const spec of await specifications()) {
    const e = entry(spec);
    if (e && !rows.some((x) => x.path === e.path)) rows.push(e);
  }
  let visited = 0,
    limited = false;
  const walk = (folder: string, depth: number): void => {
    if (depth > 6 || visited >= 2000 || rows.length >= 200) {
      limited = true;
      return;
    }
    visited++;
    try {
      for (const d of readdirSync(folder, { withFileTypes: true })) {
        if (rows.length >= 200 || visited >= 2000) {
          limited = true;
          break;
        }
        if (!d.isDirectory() || d.isSymbolicLink() || d.name === ".git") continue;
        const path = join(folder, d.name);
        if (artifacts.has(d.name)) {
          if (Date.now() - lstatSync(path).mtimeMs >= age()) {
            const e = entry(
              {
                path,
                name: `${d.name} · ${basename(folder)}`,
                category: categories.projects,
                risk: "Review",
                note: "Old build/dependency folder. Inspect the project and stop builds before permanent removal.",
              },
              "artifact",
            );
            if (e) rows.push(e);
          }
          continue;
        }
        if (!d.name.startsWith(".")) walk(path, depth + 1);
      }
    } catch {}
  };
  for (const logical of roots())
    try {
      if (existsSync(logical)) {
        const root = realpathSync(logical);
        if (!protectedRoot(root)) walk(root, 0);
      }
    } catch {}
  for (let i = 0; i < rows.length; i += 4)
    await Promise.all(
      rows.slice(i, i + 4).map(async (e) => {
        if (!existsSync(e.path)) return;
        try {
          const out = await run("/usr/bin/du", ["-sk", e.path], 15000),
            value = out.match(/^\s*(\d+)/)?.[1];
          if (value === undefined) throw new Error("Invalid du output");
          e.bytes = Number(value) * 1024;
        } catch {
          e.error = "Size unavailable or timed out; inspect permissions.";
          e.available = false;
        }
      }),
    );
  const minimum = Math.max(0, Number(str("min_app_cache_mb", "10")) || 0) * 1048576;
  const result = rows.filter((e) => e.category !== categories.system || e.error || e.bytes >= minimum);
  const [sim, containers] = await Promise.all([simulators(), docker()]);
  if (sim) result.push(sim);
  result.push(...containers);
  return {
    rows: result.toSorted(
      (a, b) =>
        Object.values(categories).indexOf(a.category) - Object.values(categories).indexOf(b.category) ||
        b.bytes - a.bytes,
    ),
    limited,
  };
};
export const validate = async (target: Cache): Promise<void> => {
  if (target.available === false || target.error)
    throw new Error("This cache is empty or unavailable. Scan again.");
  if (target.kind === "simulator") {
    if (target.id !== "simulators-unavailable" || target.risk !== "Review")
      throw new Error("Invalid simulator cleanup scope.");
    checkSimulators(
      target.simulatorIDs || [],
      simulatorDevices(
        JSON.parse(await run("/usr/bin/xcrun", ["simctl", "list", "devices", "--json"], 15000)),
      ),
    );
    return;
  }
  if (target.kind === "command") {
    if (!target.action?.startsWith("docker-") || target.path !== tool("docker") || target.risk !== "Review")
      throw new Error("Invalid container cleanup scope.");
    cleanupArgs(target.action);
    return;
  }
  const s = lstatSync(target.path);
  if (
    !s.isDirectory() ||
    s.isSymbolicLink() ||
    realpathSync(target.path) !== target.path ||
    protectedRoot(target.path) ||
    s.dev !== target.device ||
    s.ino !== target.inode
  )
    throw new Error("Cache path changed. Scan and review again.");
  const known =
    target.kind === "known" &&
    (staticSpecs().some((spec) => spec.name === target.name) ||
      target.category === categories.system ||
      target.name.startsWith("Android Snapshots · ")) &&
    (await specifications()).some(
      (spec) =>
        target.kind === "known" &&
        target.name === spec.name &&
        !spec.locationError &&
        (target.sourcePath || target.path) === spec.path &&
        existsSync(spec.path) &&
        realpathSync(spec.path) === target.path &&
        target.risk === spec.risk &&
        target.action === spec.action,
    );
  const artifact =
    target.kind === "artifact" &&
    target.risk === "Review" &&
    artifacts.has(basename(target.path)) &&
    roots().some((root) => existsSync(root) && target.path.startsWith(realpathSync(root) + sep)) &&
    Date.now() - s.mtimeMs >= age() &&
    !target.action;
  if (!known && !artifact) throw new Error("Cleanup target is outside the configured cache scope.");
};
export const clean = async (
  targets: Cache[],
  remove: (path: string) => Promise<void> = async (path) => {
    await run("/bin/rm", ["-rf", "--", path], 60000);
  },
  progress?: (completed: number, total: number) => void,
): Promise<void> => {
  if (!targets.length) throw new Error("No caches selected.");
  for (const t of targets) await validate(t);
  let completed = 0;
  for (const t of targets) {
    await validate(t);
    if (t.kind === "simulator") {
      for (const id of t.simulatorIDs || []) await run("/usr/bin/xcrun", ["simctl", "delete", id], 30000);
    } else if (t.action) {
      const bin = tool(t.action.startsWith("docker-") ? "docker" : t.action);
      if (!bin) throw new Error("Required cleanup tool is unavailable.");
      await run(bin, cleanupArgs(t.action), 60000);
    } else await remove(t.path);
    progress?.(++completed, targets.length);
  }
};
