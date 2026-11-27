import * as os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir, statfs } from "node:fs/promises";
const exec = promisify(execFile);
const command = async (file: string, args: string[]): Promise<string> => {
  try {
    return (
      await exec(file, args, { timeout: 2500, maxBuffer: 2000000, env: { ...process.env, LC_ALL: "C" } })
    ).stdout;
  } catch {
    return "";
  }
};
export type Snapshot = {
  at: number;
  cpu: { idle: number; total: number }[];
  network: Record<string, { input: number; output: number }>;
  processNetwork?: Record<string, { input: number; output: number }>;
  sections: Record<string, [string, string][]>;
  badges: Record<string, string>;
};
export const bytes = (n: number): string =>
  !Number.isFinite(n)
    ? "Unavailable"
    : n >= 1073741824
      ? `${(n / 1073741824).toFixed(1)} GB`
      : n >= 1048576
        ? `${(n / 1048576).toFixed(1)} MB`
        : `${Math.max(0, n / 1024).toFixed(1)} KB`;
export const cpuUsage = (
  current: { idle: number; total: number },
  previous?: { idle: number; total: number },
): number | null => {
  if (!previous || current.total <= previous.total) return null;
  return Math.max(
    0,
    Math.min(100, 100 * (1 - (current.idle - previous.idle) / (current.total - previous.total))),
  );
};
export const networkCounters = (text: string): Snapshot["network"] => {
  const result: Snapshot["network"] = {};
  for (const line of text.split("\n")) {
    const words = line.trim().split(/\s+/);
    if (!words[2]?.startsWith("<Link#") || words[0] === "lo0" || words.length < 10) continue;
    const input = Number(words[words.length - 5]),
      output = Number(words[words.length - 2]);
    if (Number.isFinite(input) && Number.isFinite(output)) result[words[0]!] = { input, output };
  }
  return result;
};
export const vmFields = (text: string): Record<string, number> => {
  const size = Number(text.match(/page size of (\d+) bytes/)?.[1] || 4096),
    values: Record<string, number> = {};
  for (const line of text.split("\n")) {
    const match = line.match(/^([^:]+):\s+(\d+)\./);
    if (match) values[match[1]!] = Number(match[2]) * size;
  }
  return values;
};
const pct = (n: number | null) => (n === null ? "Measuring…" : `${n.toFixed(1)} %`);
export const snapshot = async (previous?: Snapshot): Promise<Snapshot> => {
  const [vm, pressure, swap, battery, processes, net, version, model, processNet, diskInfo, powerInfo] =
    await Promise.all([
      command("/usr/bin/vm_stat", []),
      command("/usr/bin/memory_pressure", ["-Q"]),
      command("/usr/sbin/sysctl", ["-n", "vm.swapusage"]),
      command("/usr/bin/pmset", ["-g", "batt"]),
      command("/bin/ps", ["-Aco", "pid=,pcpu=,rss=,comm="]),
      command("/usr/sbin/netstat", ["-ibn"]),
      command("/usr/bin/sw_vers", ["-productVersion"]),
      command("/usr/sbin/sysctl", ["-n", "hw.model"]),
      command("/usr/bin/nettop", ["-L", "1", "-P", "-n", "-x", "-J", "bytes_in,bytes_out"]),
      command("/usr/sbin/diskutil", ["info", "/"]),
      command("/usr/sbin/ioreg", ["-r", "-c", "AppleSmartBattery", "-l"]),
    ]);
  const at = Date.now(),
    cpu = os.cpus().map((core) => ({
      idle: core.times.idle,
      total: Object.values(core.times).reduce((a, b) => a + b, 0),
    }));
  const aggregate = (values: typeof cpu) =>
    values.reduce((a, b) => ({ idle: a.idle + b.idle, total: a.total + b.total }), { idle: 0, total: 0 });
  const usage = cpuUsage(aggregate(cpu), previous ? aggregate(previous.cpu) : undefined);
  const procs = processes.split("\n").flatMap((line) => {
    const m = line.trim().match(/^(\d+)\s+([\d.]+)\s+(\d+)\s+(.+)$/);
    return m ? [{ pid: m[1]!, cpu: Number(m[2]), rss: Number(m[3]) * 1024, name: m[4]! }] : [];
  });
  const used = os.totalmem() - os.freemem(),
    memory = vmFields(vm),
    network = networkCounters(net),
    elapsed = previous ? (at - previous.at) / 1000 : 0;
  const networkRows: [string, string][] = [];
  let download = 0,
    upload = 0;
  for (const [name, count] of Object.entries(network)) {
    const before = previous?.network[name];
    if (before && elapsed > 0 && count.input >= before.input && count.output >= before.output) {
      const incoming = (count.input - before.input) / elapsed,
        outgoing = (count.output - before.output) / elapsed;
      download += incoming;
      upload += outgoing;
      networkRows.push([name, `↓ ${bytes(incoming)}/s · ↑ ${bytes(outgoing)}/s`]);
    } else networkRows.push([name, "Measuring…"]);
  }
  const processNetwork: NonNullable<Snapshot["processNetwork"]> = {};
  const processRates: [string, number, number][] = [];
  for (const line of processNet.split("\n")) {
    const m = line.match(/^([^,]+),(\d+),(\d+),/);
    if (!m) continue;
    const count = { input: Number(m[2]), output: Number(m[3]) };
    processNetwork[m[1]!] = count;
    const before = previous?.processNetwork?.[m[1]!];
    if (before && elapsed > 0 && count.input >= before.input && count.output >= before.output)
      processRates.push([
        m[1]!,
        (count.input - before.input) / elapsed,
        (count.output - before.output) / elapsed,
      ]);
  }
  networkRows.push(
    ...processRates
      .toSorted((a, b) => b[1] + b[2] - (a[1] + a[2]))
      .slice(0, 5)
      .map(([name, incoming, outgoing]): [string, string] => [
        name,
        `↓ ${bytes(incoming)}/s · ↑ ${bytes(outgoing)}/s`,
      ]),
  );
  const powerNumber = (key: string) =>
    powerInfo.match(new RegExp('"' + key + '" = (\\d+)'))?.[1] || "Unavailable";
  const diskValue = (key: string) =>
    diskInfo
      .split("\n")
      .find((line) => line.trim().startsWith(key + ":"))
      ?.split(":")
      .slice(1)
      .join(":")
      .trim() || "Unavailable";
  const diskRows: [string, string][] = [];
  let mounts = ["/"];
  try {
    mounts.push(
      ...(await readdir("/Volumes", { withFileTypes: true }))
        .filter((d) => d.isDirectory() && !d.name.startsWith("."))
        .map((d) => `/Volumes/${d.name}`),
    );
  } catch {
    // /Volumes unreadable: list the startup disk only
  }
  await Promise.all(
    mounts.map(async (path) => {
      try {
        const disk = await statfs(path);
        diskRows.push([
          path,
          `${bytes((disk.blocks - disk.bfree) * disk.bsize)} / ${bytes(disk.blocks * disk.bsize)} · ${((1 - disk.bfree / disk.blocks) * 100).toFixed(0)}%`,
        ]);
      } catch {
        diskRows.push([path, "Unavailable"]);
      }
    }),
  );
  const topCpu = procs
    .toSorted((a, b) => b.cpu - a.cpu)
    .slice(0, 3)
    .map((p, i): [string, string] => [`#${i + 1} ${p.name}`, `${p.cpu.toFixed(1)}% · PID ${p.pid}`]);
  const topMemory = procs
    .toSorted((a, b) => b.rss - a.rss)
    .slice(0, 3)
    .map((p, i): [string, string] => [`#${i + 1} ${p.name}`, `${bytes(p.rss)} · PID ${p.pid}`]);
  return {
    at,
    cpu,
    network,
    processNetwork,
    badges: {
      system: os.platform(),
      cpu: pct(usage),
      memory: `${((used / os.totalmem()) * 100).toFixed(0)} %`,
      disks: `${diskRows.length} volumes`,
      power: battery.match(/(\d+%)/)?.[1] || "AC power",
      network: previous ? `↓ ${bytes(download)}/s` : "Measuring…",
    },
    sections: {
      system: [
        ["Model", model.trim() || "Unavailable"],
        ["macOS", version.trim() || os.release()],
        ["Architecture", os.arch()],
        ["CPU", os.cpus()[0]?.model || "Unavailable"],
        ["CPU cores", String(cpu.length)],
        ["Memory", bytes(os.totalmem())],
        ["Uptime", `${(os.uptime() / 3600).toFixed(1)} hours`],
        ["Processes", processes ? String(procs.length) : "Unavailable"],
      ],
      cpu: [
        ["Usage", pct(usage)],
        [
          "Load (1, 5, 15 min)",
          os
            .loadavg()
            .map((n) => n.toFixed(2))
            .join(" · "),
        ],
        ...cpu.map((core, i): [string, string] => [`Core ${i + 1}`, pct(cpuUsage(core, previous?.cpu[i]))]),
        ...topCpu,
        ["Sensors", "Temperature/fans not exposed by standard macOS tools"],
      ],
      memory: [
        ["Physical allocated", `${bytes(used)} / ${bytes(os.totalmem())}`],
        ["Free", bytes(os.freemem())],
        [
          "Pressure",
          pressure.match(/System-wide memory free percentage:\s*(\d+)%/)?.[1]
            ? `${pressure.match(/System-wide memory free percentage:\s*(\d+)%/)![1]}% system-wide free`
            : "Unavailable",
        ],
        ...[
          "Pages active",
          "Pages inactive",
          "Pages wired down",
          "Pages occupied by compressor",
          "Pages purgeable",
        ].map((name): [string, string] => [name, name in memory ? bytes(memory[name]!) : "Unavailable"]),
        ["Swap", swap.trim() || "Unavailable"],
        ...topMemory,
      ],
      disks: [
        ...diskRows,
        ...["File System Personality", "Protocol", "SMART Status", "Device / Media Name"].map(
          (key): [string, string] => [key, diskValue(key)],
        ),
      ],
      power: [
        ["Source", battery.includes("Battery Power") ? "Battery" : "AC power"],
        ["Cycle count", powerNumber("CycleCount")],
        ["Max capacity", powerNumber("MaxCapacity")],
        ["Design capacity", powerNumber("DesignCapacity")],
        ["Battery", battery.split("\n").slice(1).join(" ").trim() || "No battery reported"],
      ],
      network: networkRows.length ? networkRows : [["Interfaces", "Unavailable"]],
    },
  };
};
