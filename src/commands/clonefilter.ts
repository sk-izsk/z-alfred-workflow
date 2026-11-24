import { basename } from "node:path";
import { type Repo, defaultCloneDir, parseRepo } from "../clone.ts";
import { bool, tildify } from "../env.ts";
import { existingDir, suggestFolders } from "../folders.ts";
import { clipboard } from "../launch.ts";

/** Alfred Script Filter item that opens the clone window (↩) or clones straight away (⌘↩). */
export const cloneItem = (repo: Repo, parent: string, title = `Clone ${repo.label}`) => ({
  title,
  subtitle: `into ${tildify(parent)}  ·  ↩ review  ·  ⌘↩ clone now`,
  arg: `${repo.url}\t${parent}`,
  icon: { path: "icons/clone.png" },
  variables: { vsc_target: "clone", vsc_action: "" },
  mods: {
    cmd: {
      subtitle: `Clone into ${tildify(parent)} and open it now`,
      arg: `${repo.url}\t${parent}`,
      variables: { vsc_target: "action", vsc_action: "clone-now" },
    },
  },
});

/** `vscc [folder] [url]`: the URL is the last token that parses as one; the rest is the folder. */
export const parseCloneQuery = (query: string): { folder: string; repo?: Repo } => {
  const tokens = query.trim().split(/\s+/);
  for (let i = tokens.length - 1; i >= 0; i--) {
    const repo = parseRepo(tokens[i]!);
    if (repo) return { repo, folder: query.trim().split(tokens[i]!)[0]!.trim() };
  }
  return { folder: query.trim() };
};

/** Clipboard URL, when "Use git URL from clipboard" is on. */
export const clipboardRepo = async (): Promise<Repo | undefined> =>
  bool("clone_clipboard", true) ? parseRepo(await clipboard().catch(() => "")) : undefined;

export const cloneFilterItems = async (query: string) => {
  const { folder, repo: typed } = parseCloneQuery(query);
  const repo = typed ?? (await clipboardRepo());
  const dir = existingDir(folder);
  const items: object[] = [];
  if (repo && (!folder || dir)) items.push(cloneItem(repo, dir ?? defaultCloneDir()));
  // Folder suggestions: Tab/↩ fills the folder in, then keep typing or paste the URL.
  if (folder && !(dir && !folder.endsWith("/") && repo)) {
    const suffix = typed ? ` ${typed.url}` : " ";
    for (const path of await suggestFolders(folder)) {
      items.push({
        title: basename(path),
        subtitle: repo ? `Clone ${repo.label} into ${tildify(path)}` : tildify(path),
        autocomplete: `${tildify(path)}/${suffix}`,
        valid: !!repo,
        arg: repo ? `${repo.url}\t${path}` : "",
        icon: { type: "fileicon", path },
        variables: { vsc_target: "clone", vsc_action: "" },
        ...(repo && { mods: cloneItem(repo, path).mods }),
      });
    }
  }
  if (!items.length) {
    items.push({
      title: repo ? `Folder not found: ${folder}` : "Clone a Repository",
      subtitle: "Type a folder (or start with ~/ or /), then paste a git URL",
      valid: false,
      icon: { path: "icons/clone.png" },
    });
  }
  return items;
};

export const cloneFilter = async ([query = ""]: string[]): Promise<void> => {
  process.stdout.write(JSON.stringify({ items: await cloneFilterItems(query) }));
};
