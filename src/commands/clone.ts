import { cloneRepo, defaultCloneDir, parseRepo, targetPath } from "../clone.ts";
import { tildify } from "../env.ts";
import { openPath } from "../launch.ts";
import { type Action, finish, merge, status, update } from "../ui.ts";

const repoOf = (url: string) => {
  const repo = parseRepo(url);
  if (!repo) throw new Error(`Not a git repository URL: ${url}`);
  return repo;
};

const previewOf = (url: string, parent: string): Action => {
  const repo = repoOf(url);
  return update({ cloneTarget: { text: tildify(targetPath(parent || defaultCloneDir(), repo.name)) } }, true);
};

export const cloneInit = async ([url = ""]: string[]): Promise<Action> => {
  const repo = repoOf(url);
  const parent = tildify(defaultCloneDir());
  return merge(
    update({ cloneRepo: { text: repo.label }, cloneParent: { text: parent } }, true),
    previewOf(url, parent),
    status("Choose where to save it, then press ↩"),
  );
};

export const clonePreview = async ([url = "", parent = ""]: string[]): Promise<Action> =>
  previewOf(url, parent);

export const cloneRun = async ([url = "", parent = ""]: string[]): Promise<Action> => {
  const repo = repoOf(url);
  const dest = targetPath(parent || defaultCloneDir(), repo.name);
  const result = await cloneRepo(repo.url, dest);
  await openPath(dest);
  return merge(
    status(result === "exists" ? "Folder already exists, opened it" : `Cloned into ${tildify(dest)}`),
    finish(),
  );
};
