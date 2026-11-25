import { join } from "node:path";
import { api, hostname, viewer } from "./api.ts";
import { str, readJson, writeJson, dataDir } from "./env.ts";
import { gh, apple, command } from "./proc.ts";
import { COMMANDS } from "./catalog.ts";
import {
  array,
  object,
  text,
  repoName,
  safeURL,
  modes,
  newView,
  type Session,
  type Mode,
  type Row,
  type Json,
} from "./model.ts";
import { loadData, repoOptions } from "./data.ts";
import { buildForm, formValues } from "./forms.ts";
import { formSubmit, mutate, MUTATIONS, rowDetail, readme } from "./operations.ts";
import { rowMenu, confirmSheet } from "./actions.ts";
import { clone, openLocal, favorite, quicklink, githubRepo, openWithApps } from "./local.ts";
import { create, save, read, beginRequest, current } from "./store.ts";
import { listComponents, formSheet, updateForm, detailSheet } from "../ui/window.ts";

const output = (value: unknown): void => {
  if (value) console.log(JSON.stringify(value));
};
const notice = (message: string): Json => ({ update: { ids: { statusLabel: { text: message } } } });
const selected = (s: Session, id = ""): Row => {
  const row = s.view.rows.find((r) => r.id === (id || s.view.selected)) || s.view.rows[0];
  if (!row) throw new Error("Select an item first.");
  return row;
};
const render = async (s: Session): Promise<Json> => {
  const options = s.view.mode === "local" ? [] : await repoOptions().catch(() => []);
  if (s.view.repo && !options.some((o) => o.value === s.view.repo))
    options.unshift({ text: s.view.repo, value: s.view.repo });
  return {
    variables: { g_session: s.id },
    update: { relayout: true, ids: { root: { components: listComponents(s, options) } } },
  };
};
const load = async (s: Session, fresh = false, append = false): Promise<Json> => {
  const ticket = beginRequest(s);
  const previous = s.view.rows;
  s.view = await loadData(s.view, fresh);
  if (!current(s, ticket)) return {};
  if (append) {
    const seen = new Set(previous.map((r) => r.id));
    s.view.rows = [...previous, ...s.view.rows.filter((r) => !seen.has(r.id))];
  }
  if (!s.view.rows.some((r) => r.id === s.view.selected)) s.view.selected = s.view.rows[0]?.id || "";
  save(s);
  return render(s);
};
const navigate = async (
  s: Session,
  mode: Mode,
  repo = "",
  patch: Partial<Session["view"]> = {},
): Promise<Json> => {
  s.view = { ...newView(mode, repo), ...patch };
  return load(s);
};
const showForm = async (s: Session, action: string, row?: Row): Promise<Json> => {
  s.form = await buildForm(action, row);
  save(s);
  return formSheet(s.form);
};
const open = (url: string): Json => ({ open: { type: "url", src: safeURL(url, hostname()) } });
const doAction = async (s: Session, op: string, id: string, args: string[]): Promise<Json> => {
  const row = selected(s, id);
  s.view.selected = row.id;
  save(s);
  if (op === "menu") {
    const menu = await rowMenu(row);
    save(s);
    return { popupmenu: { src: "actionsButton", menu } };
  }
  if (op.startsWith("form:")) return showForm(s, op.slice(5), row);
  if (MUTATIONS.has(op)) {
    await mutate(op, row);
    const result = await load(s, true);
    return { ...result, sheet: { close: "confirmSheet" } };
  }
  if (op === "detail") return detailSheet(row.title, await rowDetail(row));
  if (op === "readme") return detailSheet(row.title, await readme(row));
  if (op === "primary")
    op = row.kind === "local" ? "local-default" : row.kind === "package" ? "versions" : "open";
  if (op === "open") return row.url ? open(row.url) : notice("This item has no browser URL.");
  if (op.startsWith("copy-")) {
    const values: Record<string, string> = {
      "copy-url": row.url || "",
      "copy-title": row.title,
      "copy-markdown": `[${row.title}](${row.url || ""})`,
      "copy-number": text(row.raw.number),
      "copy-branch": text(object(row.raw.head).ref),
      "copy-path": row.path || "",
      "copy-clone": `git clone https://${hostname()}/${row.repo}.git`,
    };
    return { copy: { type: "text", src: values[op] || "" } };
  }
  if (op.startsWith("repo-") && op !== "repo-page")
    return navigate(s, op.slice(5) as Mode, row.repo || "", {
      status: op === "repo-my-prs" ? "all" : "open",
    });
  if (op === "local-prs") return navigate(s, "prs", repoName(githubRepo(row)));
  if (op === "local-my-prs") return navigate(s, "my-prs", repoName(githubRepo(row)), { status: "all" });
  if (op === "remote") {
    const url = new URL(args[0] || "");
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid remote URL.");
    return { open: { type: "url", src: url.href } };
  }
  if (op === "repo-page") return open(`https://${hostname()}/${row.repo}/${args[0] || ""}`);
  if (op === "web-ide") return open((args[0] || "https://github.dev/") + row.repo);
  if (op === "remote-editor")
    return {
      open: { type: "url", src: `vscode://GitHub.remotehub/open?url=https://${hostname()}/${row.repo}` },
    };
  if (op === "vscode-clone") {
    const build = str("vscode_build", "vscode");
    if (!["vscode", "vscode-insiders", "vscodium", "cursor"].includes(build))
      throw new Error("Unsupported editor scheme.");
    return {
      open: { type: "url", src: `${build}://vscode.git/clone?url=${encodeURIComponent(row.url || "")}` },
    };
  }
  if (op === "clone-default") {
    const parent = str("clone_path");
    if (!parent) throw new Error("Set Default Clone Folder in Workflow’s Configuration first.");
    const path = await clone(row.url + ".git", parent);
    await command("/usr/bin/open", ["-a", str("default_app", "Visual Studio Code"), path]);
    return notice("Repository cloned and opened.");
  }
  if (op === "favorite") {
    favorite(row.path || "");
    return load(s);
  }
  if (op === "quicklink") return { copy: { type: "url", src: quicklink(row) } };
  if (op === "local-open" || op === "local-default") {
    await openLocal(
      row.path || "",
      op === "local-default" ? str("default_app", "Visual Studio Code") : args[0] || "Finder",
    );
    return notice("Opened repository.");
  }
  if (op === "local-all") {
    for (const app of openWithApps()) await openLocal(row.path || "", app);
    return notice("Opened repository in configured applications.");
  }
  if (op === "versions")
    return navigate(s, "versions", "", {
      owner: text(object(row.raw.owner).login) || text((await viewer()).login),
      packageName: text(row.raw.name),
      packageType: text(row.raw.package_type),
    });
  if (op === "package-install") {
    const owner = text(object(row.raw.owner).login) || text((await viewer()).login),
      name = text(row.raw.name),
      type = text(row.raw.package_type);
    const commands: Record<string, string> = {
      container: `docker pull ghcr.io/${owner}/${name}:latest`,
      docker: `docker pull docker.pkg.github.com/${row.repo}/${name}:latest`,
      npm: `npm install @${owner}/${name}`,
      maven: `<!-- See ${row.url} for Maven coordinates -->`,
      nuget: `dotnet add package ${name}`,
      rubygems: `gem install ${name}`,
    };
    return { copy: { type: "text", src: commands[type] || name } };
  }
  if (op === "commits") {
    const commits = array(await api(`repos/${row.repo}/pulls/${text(row.raw.number)}/commits?per_page=100`));
    return detailSheet(
      "Commits",
      commits
        .map(
          (c) =>
            `### ${text(c.sha).slice(0, 7)}\n${text(object(c.commit).message)}\n[Open](${text(c.html_url)})`,
        )
        .join("\n\n"),
    );
  }
  if (op === "diff") {
    const diff = await gh(["pr", "diff", text(row.raw.number), "--repo", row.repo || ""]);
    return detailSheet("Pull Request Diff", "```diff\n" + diff.replaceAll("```", "` ` `") + "\n```");
  }
  if (op === "preview") {
    const comments = array(
      await api(`repos/${row.repo}/issues/${text(row.raw.number)}/comments?per_page=100`),
    );
    const comment = comments.filter((c) => /^vercel(?:\[bot\])?$/.test(text(object(c.user).login))).pop();
    const url = text(comment?.body).match(/\[Visit Preview\]\((https:\/\/[^)]+)\)/)?.[1];
    if (!url) throw new Error("No Vercel preview link was found.");
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error("Invalid preview URL.");
    return { open: { type: "url", src: parsed.href } };
  }
  if (op === "pin-workflow") {
    const path = join(dataDir(), "pinned-workflows.json"),
      pins = readJson<string[]>(path, []),
      key = `${row.repo}:${row.id}`;
    writeJson(path, pins.includes(key) ? pins.filter((v) => v !== key) : [...pins, key]);
    return notice(pins.includes(key) ? "Workflow unpinned" : "Workflow pinned");
  }
  throw new Error("Unknown action.");
};
const rootItems = (query: string): Json => ({
  items: COMMANDS.filter((c) =>
    `${c.title} ${c.description}`.toLowerCase().includes(query.toLowerCase()),
  ).map((c) => ({
    uid: c.id,
    title: c.title,
    subtitle: c.description,
    arg: "",
    variables: { g_mode: c.mode || "repos", g_form: c.form || "" },
    icon: { path: c.mode === "local" ? "assets/git-repos/git-repos-icon.png" : "icon.png" },
  })),
});
const launch = async (): Promise<Json> => {
  const mode = str("g_mode", "repos") as Mode;
  if (!modes.includes(mode)) throw new Error("Unknown GitHub view.");
  const s = create(mode);
  s.view.query = str("g_query");
  if (str("g_form")) {
    const result = await render(s);
    s.form = await buildForm(str("g_form"));
    save(s);
    return { ...result, ...formSheet(s.form) };
  }
  if (["runs", "workflows", "releases"].includes(mode) && !s.view.repo)
    s.view.repo = (await repoOptions())[0]?.value || "";
  return load(s);
};
const main = async (): Promise<unknown> => {
  const [cmd = "root", id = "", ...args] = process.argv.slice(2);
  if (cmd === "root") return rootItems(id);
  if (cmd === "post") {
    if (str("github_out") === "back")
      await apple('tell application id "com.runningwithcrayons.Alfred" to search (item 1 of argv)', [""]);
    return;
  }
  if (cmd === "open-local") {
    await openLocal(id, str("default_app", "Visual Studio Code"));
    return;
  }
  if (cmd === "launch") return launch();
  if (cmd === "back") return { finish: { variables: { github_out: "back" } } };
  const s = read(id);
  switch (cmd) {
    case "selected":
      s.view.selected = args[0] || "";
      save(s);
      return {};
    case "refresh":
      s.view.page = 1;
      return load(s, true);
    case "more":
      s.view.page++;
      return load(s, false, true);
    case "search":
      s.view.query = args[0] || "";
      s.view.page = 1;
      return load(s);
    case "status":
    case "relation":
    case "sort":
      s.view[cmd] = args[0] || "";
      s.view.page = 1;
      return load(s);
    case "repository":
      s.view.repo = args[0] ? repoName(args[0]) : "";
      s.view.page = 1;
      return load(s);
    case "back":
      return { finish: { variables: { github_out: "back" } } };
    case "action":
      return doAction(s, args[0] || "", args[1] || "", args.slice(2));
    case "confirm":
      return confirmSheet(selected(s, args[1]), args[0] || "");
    case "execute": {
      const op = args[0] || "";
      if (!MUTATIONS.has(op)) throw new Error("Unknown mutation.");
      return doAction(s, op, args[1] || "", []);
    }
    case "form-close":
      s.form = undefined;
      save(s);
      return { sheet: { close: "formSheet" } };
    case "form-back":
      return { sheet: { close: "formSheet" }, finish: { variables: { github_out: "back" } } };
    case "form-page": {
      if (!s.form) throw new Error("Form expired.");
      s.form.values = formValues(s.form, args.slice(1));
      const max = Math.ceil(s.form.fields.length / 7) - 1;
      s.form.values.formPage = String(
        Math.min(max, Math.max(0, Number(s.form.values.formPage || 0) + Number(args[0] || 0))),
      );
      save(s);
      return updateForm(s.form);
    }
    case "form-repository": {
      if (!s.form) throw new Error("Form expired.");
      const values = formValues(s.form, args);
      s.form = await buildForm(s.form.action, s.form.row, values);
      save(s);
      return updateForm(s.form);
    }
    case "submit": {
      if (!s.form) throw new Error("Form expired.");
      s.form.values = formValues(s.form, args);
      save(s);
      if (s.form.action === "owner") {
        const owner = s.form.values.owner || "";
        s.form = undefined;
        const result = await navigate(s, "projects", "", { owner });
        return { ...result, sheet: { close: "formSheet" } };
      }
      const outcome = await formSubmit(s.form);
      s.form = undefined;
      s.view.notice = outcome.message;
      save(s);
      const result = await render(s);
      return { ...result, sheet: { close: "formSheet" }, ...(outcome.url ? open(outcome.url) : {}) };
    }
    default:
      throw new Error("Unknown GitHub command.");
  }
};
try {
  output(await main());
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  const commandName = process.argv[2];
  if (commandName === "submit" || commandName === "form-repository")
    output({ update: { ids: { formError: { text: message }, formSubmit: { enabled: true } } } });
  else
    output(
      notice(
        message.includes("HTTP 401") || message.includes("authentication")
          ? `${message}\nRun gh auth login in Terminal.`
          : message,
      ),
    );
}
