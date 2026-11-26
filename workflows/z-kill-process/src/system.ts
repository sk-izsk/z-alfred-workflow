import { existsSync } from "node:fs";
import { exec, run } from "./proc.ts";
import { parseProcesses, parseCPU, parseMemory, type ProcessInfo, type Metrics } from "./model.ts";
export const processes = async (): Promise<ProcessInfo[]> =>
  parseProcesses(
    await exec("/bin/ps", ["-ww", "-axo", "pid=,ppid=,uid=,%cpu=,rss=,lstart=,comm="], {
      timeoutMs: 5000,
      env: { ...process.env, LC_ALL: "C", LANG: "C" },
    }),
  );
export const metrics = async (): Promise<Metrics> => {
  const [top, vm, total] = await Promise.all([
    run("/usr/bin/top", ["-l", "2", "-s", "1", "-n", "0"], {
      timeoutMs: 6000,
      env: { ...process.env, LC_ALL: "C", LANG: "C" },
    }),
    run("/usr/bin/vm_stat", [], { timeoutMs: 3000 }),
    run("/usr/sbin/sysctl", ["-n", "hw.memsize"], { timeoutMs: 3000 }),
  ]);
  return {
    cpu: top.code === 0 ? parseCPU(top.stdout) : null,
    ...parseMemory(vm.code === 0 ? vm.stdout : "", total.code === 0 ? Number(total.stdout.trim()) : 0),
  };
};
export const ancestors = (rows: ProcessInfo[], pid = process.pid): Set<number> => {
  const ids = new Set<number>();
  let cursor = pid;
  while (cursor > 1 && !ids.has(cursor)) {
    ids.add(cursor);
    cursor = rows.find((p) => p.pid === cursor)?.ppid || 0;
  }
  return ids;
};
export const appExists = (path: string): boolean =>
  path.startsWith("/") && path.endsWith(".app") && existsSync(path);
