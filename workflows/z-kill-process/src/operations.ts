import { type Plan, type ProcessInfo, sameProcess, validateTarget, operations } from "./model.ts";
export type Driver = {
  list: () => Promise<ProcessInfo[]>;
  signal: (pid: number, signal: "SIGTERM" | "SIGKILL") => void;
  open: (app: string) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
};
export const executePlan = async (
  plan: Plan,
  driver: Driver,
  uid: number,
  protectedPids: Set<number>,
): Promise<string> => {
  if (
    !plan ||
    !operations.includes(plan.operation) ||
    !Array.isArray(plan.targets) ||
    !plan.targets.length ||
    !Number.isFinite(plan.created) ||
    Date.now() - plan.created > 60000 ||
    plan.created > Date.now() + 1000
  )
    throw new Error("This confirmation expired. Select the process again.");
  const latest = await driver.list();
  // Preflight the complete snapshot before sending any signal; never expand a confirmed group.
  for (const target of plan.targets) {
    const current = latest.find((p) => p.pid === target.pid);
    if (!current || !sameProcess(target, current))
      throw new Error("A selected process exited or its PID was reused. Review the action again.");
    validateTarget(current, uid, protectedPids);
  }
  if (
    plan.operation.includes("restart") &&
    (!plan.app ||
      !plan.app.endsWith(".app") ||
      !plan.app.startsWith("/") ||
      plan.targets.some((p) => p.app !== plan.app))
  )
    throw new Error("Invalid app restart.");
  const signal = plan.operation.startsWith("force") ? "SIGKILL" : "SIGTERM";
  const failed: number[] = [];
  for (const target of plan.targets) {
    // Recheck immediately before each signal as the user may have closed an app during confirmation.
    const current = (await driver.list()).find((p) => p.pid === target.pid);
    if (!current) continue;
    if (!sameProcess(target, current)) {
      failed.push(target.pid);
      continue;
    }
    try {
      driver.signal(target.pid, signal);
    } catch {
      failed.push(target.pid);
    }
  }
  if (failed.length)
    throw new Error(
      `Could not signal PID ${failed.join(", ")}. Refresh the list; the process may have exited or denied permission.`,
    );
  if (plan.operation.includes("restart")) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const running = await driver.list();
      if (!running.some((p) => plan.targets.some((t) => sameProcess(t, p)))) {
        await driver.open(plan.app);
        return "App reopened.";
      }
      await driver.sleep(150);
    }
    throw new Error(
      "The app is still running, possibly waiting to save work. Restart was not launched again.",
    );
  }
  return `${signal === "SIGTERM" ? "Termination requested" : "Force-kill signal sent"} for ${plan.targets.length} process${plan.targets.length === 1 ? "" : "es"}.`;
};
