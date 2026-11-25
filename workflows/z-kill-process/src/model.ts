import { basename } from "node:path";
export type ProcessInfo = {
  id: string;
  pid: number;
  ppid: number;
  uid: number;
  cpu: number;
  memory: number;
  started: string;
  path: string;
  name: string;
  app: string;
};
export type Metrics = { cpu: number | null; memory: number | null; used: number; total: number };
export const parseProcesses = (text: string): ProcessInfo[] =>
  text.split(/\r?\n/).flatMap((line) => {
    const m = line.match(
      /^\s*(\d+)\s+(\d+)\s+(\d+)\s+([\d.]+)\s+(\d+)\s+(\w+\s+\w+\s+\d+\s+[\d:]+\s+\d{4})\s+(.+?)\s*$/,
    );
    if (!m) return [];
    const [, pid, ppid, uid, cpu, rss, started, path] = m as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    if (!Number.isFinite(Number(cpu))) return [];
    const app = path.match(/^(.+?\.app)(?:\/|$)/)?.[1] || "";
    return [
      {
        id: `${pid}:${started}`,
        pid: Number(pid),
        ppid: Number(ppid),
        uid: Number(uid),
        cpu: Number(cpu),
        memory: Number(rss) * 1024,
        started,
        path,
        name: basename(path),
        app,
      },
    ];
  });
const clamp = (value: number) => Math.max(0, Math.min(100, value));
export const parseCPU = (text: string): number | null => {
  const matches = [...text.matchAll(/CPU usage:\s*[\d.]+% user,\s*[\d.]+% sys,\s*([\d.]+)% idle/g)];
  const idle = matches.at(-1)?.[1];
  return idle === undefined ? null : clamp(100 - Number(idle));
};
export const parseMemory = (text: string, total: number): Pick<Metrics, "memory" | "used" | "total"> => {
  const page = Number(text.match(/page size of (\d+) bytes/)?.[1]);
  const field = (name: string) => Number(text.match(new RegExp(`${name}:\\s*(\\d+)`))?.[1] ?? NaN);
  const used =
    (field("Pages active") + field("Pages wired down") + field("Pages occupied by compressor")) * page;
  if (!Number.isFinite(used) || !page || !Number.isFinite(total) || total <= 0)
    return { memory: null, used: 0, total: 0 };
  return { memory: clamp((used / total) * 100), used: Math.min(total, used), total };
};
export const bytes = (value: number): string => {
  if (value < 1024) return `${Math.round(value)} B`;
  const units = ["KiB", "MiB", "GiB", "TiB"];
  let n = value / 1024,
    index = 0;
  while (n >= 1024 && index < units.length - 1) {
    n /= 1024;
    index++;
  }
  return `${n.toFixed(n >= 100 ? 0 : 1)} ${units[index]}`;
};
export const filterProcesses = (
  rows: ProcessInfo[],
  query: string,
  sort: string,
  paths = true,
): ProcessInfo[] => {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return rows
    .filter((p) =>
      words.every((word) => `${p.name} ${p.pid}${paths ? " " + p.path : ""}`.toLowerCase().includes(word)),
    )
    .toSorted(
      (a, b) =>
        (sort === "memory" ? b.memory - a.memory : b.cpu - a.cpu) ||
        a.name.localeCompare(b.name) ||
        a.pid - b.pid,
    );
};
export type Operation = "terminate" | "force" | "restart" | "force-restart" | "terminate-all" | "force-all";
export const operations: Operation[] = [
  "terminate",
  "force",
  "restart",
  "force-restart",
  "terminate-all",
  "force-all",
];
export const titles: Record<Operation, string> = {
  terminate: "Kill Process",
  force: "Force Kill",
  restart: "Restart App",
  "force-restart": "Force Restart App",
  "terminate-all": "Kill All Matching Processes",
  "force-all": "Force Kill All Matching Processes",
};
export const sameProcess = (a: ProcessInfo, b: ProcessInfo): boolean =>
  a.pid === b.pid && a.uid === b.uid && a.started === b.started && a.path === b.path;
export const validateTarget = (p: ProcessInfo, uid: number, ancestors: Set<number>): void => {
  if (
    p.pid <= 1 ||
    ancestors.has(p.pid) ||
    /(?:^|\/)(?:WindowServer|loginwindow|kernel_task|launchd|Alfred)(?:$| )/.test(p.path)
  )
    throw new Error("This process is protected to keep macOS and this workflow running.");
  if (p.uid !== uid)
    throw new Error(
      "This process belongs to another user. Use Activity Monitor with the appropriate privileges.",
    );
};
export type Plan = { operation: Operation; targets: ProcessInfo[]; app: string; created: number };
export const makePlan = (
  operation: string,
  target: ProcessInfo,
  all: ProcessInfo[],
  uid: number,
  ancestors: Set<number>,
): Plan => {
  if (!operations.includes(operation as Operation)) throw new Error("Unknown process action.");
  const targets = operation.endsWith("-all")
    ? all.filter((p) => p.path === target.path)
    : operation.includes("restart")
      ? all.filter((p) => p.app === target.app)
      : [target];
  if (operation.includes("restart") && !target.app)
    throw new Error(
      "Only app processes can be restarted. Background commands have no reliable launch recipe.",
    );
  if (!targets.length) throw new Error("The process has already exited.");
  for (const p of targets) validateTarget(p, uid, ancestors);
  return {
    operation: operation as Operation,
    targets,
    app: operation.includes("restart") ? target.app : "",
    created: Date.now(),
  };
};
