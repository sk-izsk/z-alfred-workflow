import { cloneRepo, defaultCloneDir, parseRepo, targetPath } from "../clone.ts";
import { tildify } from "../env.ts";
import { openPath } from "../launch.ts";
import { type Action, finish, merge, status, update } from "../ui.ts";

/** The window's query is `url` or `url<TAB>folder` (from `vscc folder url`). */
const parse = (query: string) => {
  const [url = "", parent = ""] = query.split("\t");
  const repo = parseRepo(url);
  if (!repo) throw new Error(`Not a git repository URL: ${url}`);
  return { repo, parent: parent || defaultCloneDir() };
};

const previewOf = (query: string, parent: string): Action => {
  const { repo } = parse(query);
  return update({ cloneTarget: { text: tildify(targetPath(parent || defaultCloneDir(), repo.name)) } }, true);
};

export const cloneInit = async ([query = ""]: string[]): Promise<Action> => {
  const { repo, parent } = parse(query);
  return merge(
    update({ cloneRepo: { text: repo.label }, cloneParent: { text: tildify(parent) } }, true),
    previewOf(query, parent),
    status("Choose where to save it, then press ↩"),
  );
};

export const clonePreview = async ([query = "", parent = ""]: string[]): Promise<Action> =>
  previewOf(query, parent);

export const cloneRun = async ([query = "", parent = ""]: string[]): Promise<Action> => {
  const { repo } = parse(query);
  const dest = targetPath(parent || defaultCloneDir(), repo.name);
  const result = await cloneRepo(repo.url, dest);
  await openPath(dest);
  return merge(
    status(result === "exists" ? "Folder already exists, opened it" : `Cloned into ${tildify(dest)}`),
    finish(),
  );
};
