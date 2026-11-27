import { workflowEnv } from "../../../shared/env.ts";

export const { BUNDLE_ID, workflowDir, str, bool, dataDir, cacheDir, writeJson, readJson } =
  workflowEnv("com.izsk.translate");
