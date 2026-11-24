import { str } from "../env.ts";
import { alfredActions, alfredSearch } from "../launch.ts";

/** Runs after a window closes: back to the `code` menu, or Alfred's File Actions for a path. */
export const post = async (): Promise<void> => {
  const out = process.env.vsc_out ?? "";
  if (out === "back") await alfredSearch(`${str("kw_main", "code")} `);
  if (out === "file-actions") await alfredActions(process.env.vsc_path ?? "");
};
