import { execFileSync } from "node:child_process";

/** Seconds since the epoch out of a `sysctl` time value like `{ sec = 1795, usec = 2 } Mon Nov …`. */
export const parseSysctlTime = (value: string): number | undefined => {
  const sec = /sec = (\d+)/.exec(value)?.[1];
  return sec === undefined ? undefined : Number(sec);
};

export type SystemTimes = { wake: number | undefined; boot: number | undefined };

const read = (name: string): number | undefined => {
  try {
    const out = execFileSync("/usr/sbin/sysctl", ["-n", name], {
      encoding: "utf8",
      env: { PATH: "/usr/sbin:/usr/bin:/bin" },
      timeout: 2000,
    });
    return parseSysctlTime(out);
  } catch {
    return undefined;
  }
};

/** When the Mac last woke from sleep (0 = never since boot) and when it last booted. Costs ~2 ms each. */
export const systemTimes = (): SystemTimes => ({ wake: read("kern.waketime"), boot: read("kern.boottime") });

/**
 * Did the Mac sleep or restart after `lastUsedMs`? A wake or boot later than the last use means yes.
 * Missing readings mean "don't know", which never locks: a failed lookup must not log you out.
 */
export const wokeSince = (lastUsedMs: number, times: SystemTimes = systemTimes()): boolean => {
  const last = lastUsedMs / 1000;
  return (times.wake !== undefined && times.wake > last) || (times.boot !== undefined && times.boot > last);
};
