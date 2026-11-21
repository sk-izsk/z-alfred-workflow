import { jxa } from "./proc.ts";

/**
 * Touch ID through LocalAuthentication, called from JXA so no compiled (unsigned) binary ships.
 * Policy 2 = LAPolicyDeviceOwnerAuthentication: Touch ID when available, otherwise
 * Apple Watch or the Mac login password, so Macs without a sensor still get a system prompt.
 * The reply block fires on another thread; the run loop is spun until it does.
 */
const promptScript = (reason: string) => `
ObjC.import("LocalAuthentication");
ObjC.import("Foundation");
const ctx = $.LAContext.alloc.init;
let state = "pending";
ctx.evaluatePolicyLocalizedReasonReply(2, ${JSON.stringify(reason)}, (ok, err) => { state = ok ? "ok" : "denied"; });
const until = Date.now() + 60000;
while (state === "pending" && Date.now() < until) {
  $.NSRunLoop.currentRunLoop.runModeBeforeDate($.NSDefaultRunLoopMode, $.NSDate.dateWithTimeIntervalSinceNow(0.1));
}
state;`;

const availableScript = `
ObjC.import("LocalAuthentication");
const ctx = $.LAContext.alloc.init;
JSON.stringify({ any: ctx.canEvaluatePolicyError(2, null), touchId: ctx.canEvaluatePolicyError(1, null) });`;

export type Availability = { any: boolean; touchId: boolean };

export const touchIdAvailability = async (): Promise<Availability> =>
  JSON.parse(await jxa(availableScript)) as Availability;

/** Resolves true only when the user passes the system prompt. */
export const authenticate = async (reason = "unlock your Bitwarden vault"): Promise<boolean> =>
  (await jxa(promptScript(reason), "", 65_000).catch(() => "denied")) === "ok";
