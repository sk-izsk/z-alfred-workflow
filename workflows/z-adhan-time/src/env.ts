import { workflowEnv } from "../../../shared/env.ts";

export const { BUNDLE_ID, workflowDir, str, bool, dataDir, cacheDir, writeJson, readJson } =
  workflowEnv("com.izsk.adhan-time");

export const cacheMinutes = (key: string, fallback: number): number => {
  const n = Number(str(key, String(fallback)));
  return Number.isFinite(n) && n >= 1 && n <= 10080 ? n : fallback;
};
