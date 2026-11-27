import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { basename, dirname, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
const execute = promisify(execFile);
export const exec = async (command: string, args: string[], empty = false): Promise<string> => {
  try {
    return (
      await execute(command, args, {
        encoding: "utf8",
        timeout: 8000,
        maxBuffer: 4e6,
        env: { ...process.env, LC_ALL: "C" },
      })
    ).stdout;
  } catch (error: any) {
    if (empty && error.code === 1 && !error.killed) return error.stdout || "";
    throw new Error(`${basename(command)} inspection failed or timed out.`, { cause: error });
  }
};
export type Server = {
  id: string;
  pid: number;
  started: string;
  command: string;
  cwd: string;
  project: string;
  framework: string;
  port: number;
  url: string;
};
export const processes = (text: string): { pid: number; started: string; command: string }[] =>
  text.split("\n").flatMap((line) => {
    const m = line.match(/^\s*(\d+)\s+(.{24})\s+(.+)$/);
    return m ? [{ pid: Number(m[1]), started: m[2]!, command: m[3]! }] : [];
  });
export const listeners = (text: string): { pid: number; port: number }[] => {
  const out: { pid: number; port: number }[] = [];
  let pid = 0;
  for (const line of text.split("\n")) {
    if (line.startsWith("p")) pid = Number(line.slice(1));
    if (line.startsWith("n")) {
      const port = Number(line.match(/:(\d+)$/)?.[1]);
      if (pid > 1 && port > 0 && port < 65536 && !out.some((x) => x.pid === pid && x.port === port))
        out.push({ pid, port });
    }
  }
  return out;
};
export const framework = (command: string): string => {
  const known = [
    "next",
    "vite",
    "astro",
    "nuxt",
    "webpack",
    "remix",
    "wrangler",
    "svelte",
    "django",
    "flask",
    "uvicorn",
    "gunicorn",
    "rails",
    "hugo",
  ];
  const match = known.find((x) => new RegExp(`(?:^|[ /])${x}(?:[ /.-]|$)`, "i").test(command));
  if (match) return match;
  return /(?:^|\/)(?:node|bun|deno|python[\d.]*|ruby|php[\d.]*|go|cargo|dotnet)(?:\s|$)/i.test(command)
    ? "Other"
    : "";
};
export const scan = async (): Promise<Server[]> => {
  const [ps, ports] = await Promise.all([
    exec("/bin/ps", ["-A", "-ww", "-o", "pid=,lstart=,command="]),
    exec("/usr/sbin/lsof", ["-nP", "-iTCP", "-sTCP:LISTEN", "-Fpn"], true),
  ]);
  const found = processes(ps),
    out: Server[] = [];
  for (const listener of listeners(ports)) {
    const p = found.find((x) => x.pid === listener.pid);
    if (!p || p.pid === process.pid || !framework(p.command)) continue;
    const cwd =
      (await exec("/usr/sbin/lsof", ["-a", "-p", String(p.pid), "-d", "cwd", "-Fn"], true))
        .split("\n")
        .find((x) => x.startsWith("n"))
        ?.slice(1) || "";
    if (!cwd || cwd === "/" || !existsSync(cwd)) continue;
    out.push({
      ...p,
      cwd,
      project: basename(cwd),
      framework: framework(p.command),
      port: listener.port,
      id: `${p.pid}:${listener.port}`,
      url: `http://localhost:${listener.port}`,
    });
  }
  return out.toSorted((a, b) => a.cwd.localeCompare(b.cwd) || a.port - b.port);
};
export const sameIdentity = (before: Server, current: Server): boolean =>
  before.pid === current.pid &&
  before.started === current.started &&
  before.command === current.command &&
  before.cwd === current.cwd &&
  before.port === current.port;
export const stop = async (targets: Server[]): Promise<void> => {
  if (!targets.length) throw new Error("No selected servers.");
  const current = await scan();
  if (targets.some((t) => !current.some((c) => sameIdentity(t, c))))
    throw new Error("A server changed or exited. Refresh before stopping.");
  for (const t of new Map(targets.map((target) => [target.pid, target])).values()) {
    const identity = processes(
      await exec("/bin/ps", ["-ww", "-p", String(t.pid), "-o", "pid=,lstart=,command="], true),
    )[0];
    if (!identity || identity.started !== t.started || identity.command !== t.command)
      throw new Error("Process identity changed; stop canceled.");
    process.kill(t.pid, "SIGTERM");
  }
};
export const quote = (value: string): string => "'" + value.replace(/'/g, "'\\''") + "'";
export const restartPlan = (server: Server): string => {
  let folder = server.cwd;
  for (let level = 0; level < 5; level++) {
    const file = join(folder, "package.json");
    if (existsSync(file)) {
      let pkg: any;
      try {
        pkg = JSON.parse(readFileSync(file, "utf8"));
      } catch {
        throw new Error("Invalid project package.json.");
      }
      const script = ["dev", "start", "develop"].find((x) => typeof pkg.scripts?.[x] === "string");
      if (!script)
        throw new Error("No dev/start/develop script. Start this server in its original terminal.");
      const manager = existsSync(join(folder, "pnpm-lock.yaml"))
        ? "pnpm"
        : existsSync(join(folder, "yarn.lock"))
          ? "yarn"
          : existsSync(join(folder, "bun.lock")) || existsSync(join(folder, "bun.lockb"))
            ? "bun"
            : "npm";
      return `cd ${quote(folder)} && ${manager} run ${quote(script)}`;
    }
    const parent = dirname(folder);
    if (parent === folder) break;
    folder = parent;
  }
  throw new Error("Restart requires a project package.json. Use the original terminal for other servers.");
};

export const uptime = (started: string, now = Date.now()): string => {
  const ms = now - Date.parse(started);
  if (!Number.isFinite(ms) || ms < 0) return "Unknown uptime";
  const seconds = Math.floor(ms / 1000);
  return seconds >= 3600
    ? `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
    : seconds >= 60
      ? `${Math.floor(seconds / 60)}m`
      : `${seconds}s`;
};
