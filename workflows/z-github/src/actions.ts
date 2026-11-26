import { api } from "./api.ts";
import { object, text, type Row, type Json } from "./model.ts";
import { openWithApps, githubRepo } from "./local.ts";
import { run, json } from "../ui/window.ts";
export const menuItem = (
  title: string,
  operation: string,
  row: Row,
  args: string[] = [],
  confirm = false,
): Json => ({ text: title, action: run(confirm ? "confirm" : "action", [operation, row.id, ...args]) });
const submenu = (title: string, items: Json[]): Json => ({ text: title, submenu: items });
export const rowMenu = async (row: Row): Promise<Json[]> => {
  const items: Json[] = [{ text: row.repo || row.title }];
  const item = (title: string, op: string, args: string[] = [], confirm = false) =>
    menuItem(title, op, row, args, confirm);
  if (row.kind === "local") {
    items.push(
      ...openWithApps().map((app) => item(`Open in ${app}`, "local-open", [app])),
      item("Open in All Applications", "local-all"),
      item("Open With…", "form:openwith"),
      item(row.raw.favorite ? "Remove from Favorites" : "Add to Favorites", "favorite"),
      item("Copy Alfred Quicklink", "quicklink"),
      item("Copy Path to Clipboard", "copy-path"),
    );
    const remotes = object(row.raw.remotes);
    for (const [name, value] of Object.entries(remotes)) {
      const url = text(value);
      items.push(
        submenu(`Open ${name} on ${new URL(url).hostname}`, [
          item("Code", "remote", [url]),
          item("Issues", "remote", [url + "/issues"]),
          item("Pull Requests", "remote", [url + "/pulls"]),
        ]),
      );
    }
    try {
      githubRepo(row);
      items.push(
        item("My Pull Requests in This Repository", "local-my-prs"),
        item("All Pull Requests in This Repository", "local-prs"),
      );
    } catch {
      /* Non-GitHub remotes still have their browser actions. */
    }
    items.push(
      { type: "separator" },
      item("Remove Repository…", "trash", [], true),
      item("Force Remove Repository…", "trash-force", [], true),
    );
  } else {
    if (row.url) items.push(item("Open in Browser  ↩", "open"));
    if (row.kind === "repo")
      items.push(
        item("My Pull Requests in This Repository", "repo-my-prs"),
        item("All Pull Requests in This Repository", "repo-prs"),
        { type: "separator" },
      );
    items.push(
      item("Show Details", "detail"),
      item("Copy URL  ⌘C", "copy-url"),
      item("Copy Title", "copy-title"),
      item("Copy Markdown URL", "copy-markdown"),
    );
  }
  if (row.kind === "repo") {
    const r = object(await api(`repos/${row.repo}`));
    row.raw = { ...row.raw, ...r };
    items.push(
      submenu("Repository", [
        item("Show Issues", "repo-issues"),
        item("Show Discussions", "repo-discussions"),
        item("Show Releases", "repo-releases"),
        item("Workflow Runs", "repo-runs"),
        item("Show Readme", "readme"),
      ]),
      submenu("Clone / Download", [
        item("Clone and Open (Default Path)", "clone-default"),
        item("Clone with Options…", "form:clone"),
        item("Clone in VS Code", "vscode-clone"),
        item("Download as ZIP…", "form:download"),
        item("Copy Clone Command", "copy-clone"),
      ]),
      submenu("Open in Web IDE", [
        item("GitHub.dev", "web-ide", ["https://github.dev/"]),
        item("VS Code Web", "web-ide", ["https://vscode.dev/github/"]),
        item("Gitpod", "web-ide", ["https://gitpod.io/#https://github.com/"]),
        item("CodeSandbox", "web-ide", ["https://codesandbox.io/s/github/"]),
        item("Replit", "web-ide", ["https://repl.it/github/"]),
        item("Glitch", "web-ide", ["https://glitch.com/edit/#!/import/github/"]),
        item("VS Code Remote Repositories", "remote-editor"),
        item("Sourcegraph", "web-ide", ["https://sourcegraph.com/github.com/"]),
        item("DeepWiki", "web-ide", ["https://deepwiki.com/"]),
      ]),
      submenu("Create", [
        item("Create Pull Request…", "form:create-pr"),
        item("Create Issue…", "form:create-issue"),
        item("Create Branch…", "form:create-branch"),
        item("Create Release…", "form:create-release"),
        item("Dispatch Workflow…", "form:dispatch"),
      ]),
      item("Star Repository", "star"),
      item("Unstar Repository", "unstar"),
      submenu(
        "Open GitHub Page",
        ["pulls", "issues", "wiki", "projects", "discussions", "actions"].map((path) =>
          item(path[0]!.toUpperCase() + path.slice(1), "repo-page", [path]),
        ),
      ),
    );
  }
  if (row.kind === "pr" || row.kind === "issue") {
    const number = text(row.raw.number),
      repo = row.repo!;
    const details = object(await api(`repos/${repo}/${row.kind === "pr" ? "pulls" : "issues"}/${number}`));
    row.raw = { ...row.raw, ...details };
    items.push(
      item("Copy Number", "copy-number"),
      item("Assign to Me", "assign-me"),
      item("Unassign from Me", "unassign-me"),
      item("Edit Labels / Assignees…", "form:metadata"),
      item("Add to Project…", "form:project"),
      item("Set Milestone…", "form:milestone"),
      item("Add Comment…", "form:comment"),
    );
    if (row.kind === "pr") {
      const open = details.state === "open";
      items.push(
        item("Copy Branch Name", "copy-branch"),
        item("Add Review…", "form:review"),
        item("Request Review…", "form:reviewers"),
        item("See Commits", "commits"),
        item("View Diff", "diff"),
        item("Checkout Pull Request…", "form:checkout"),
        item("Open Vercel Preview", "preview"),
      );
      if (open && !details.merged) {
        items.push(
          item("Ready for Review", "ready", [], true),
          submenu(
            "Merge Pull Request…",
            ["merge", "squash", "rebase"].map((method) =>
              item(`${method[0]!.toUpperCase() + method.slice(1)} and Merge`, "merge-" + method, [], true),
            ),
          ),
          submenu(
            "Enable Auto-Merge",
            ["merge", "squash", "rebase"].map((method) => item(method, "auto-" + method, [], true)),
          ),
          item("Disable Auto-Merge", "disable-auto", [], true),
          item("Add to Merge Queue", "enqueue", [], true),
          item("Remove from Merge Queue", "dequeue", [], true),
          item("Close Pull Request…", "close", [], true),
        );
      } else if (!details.merged) items.push(item("Reopen Pull Request", "reopen", [], true));
    } else {
      items.push(
        item("Create Issue Branch…", "form:create-branch"),
        item("Set Issue Type…", "form:issueType"),
        item("Delete Issue Branch…", "issue-delete-branch", [], true),
      );
      items.push(
        ...(details.state === "open"
          ? [
              item("Close as Completed…", "close-completed", [], true),
              item("Close as Not Planned…", "close-not-planned", [], true),
            ]
          : [item("Reopen Issue", "reopen", [], true)]),
      );
    }
  }
  if (row.kind === "run") {
    items.push(
      ...(row.raw.status === "completed"
        ? [item("Rerun Workflow", "rerun", [], true), item("Rerun Failed Jobs", "rerun-failed", [], true)]
        : [item("Cancel Run…", "cancel-run", [], true)]),
      item("Delete Run…", "delete-run", [], true),
    );
  }
  if (row.kind === "workflow")
    items.push(item("Dispatch Workflow…", "form:dispatch"), item("Pin / Unpin Workflow", "pin-workflow"));
  if (row.kind === "notification")
    items.push(
      item("Mark as Read", "notification-read"),
      item("Mark All as Read…", "notifications-read-all", [], true),
      item("Mark as Done", "notification-done"),
      item("Unsubscribe…", "notification-unsubscribe", [], true),
      item("Accept Repository Invitation…", "accept-invitation", [], true),
    );
  if (row.kind === "project")
    items.push(
      item(
        row.raw.closed ? "Reopen Project…" : "Close Project…",
        row.raw.closed ? "project-reopen" : "project-close",
        [],
        true,
      ),
    );
  if (row.kind === "package")
    items.push(
      item("Show Versions", "versions"),
      item("Copy Package Name", "copy-title"),
      item("Copy Install Command", "package-install"),
    );
  if (row.kind === "version") items.push(item("Copy Version", "copy-title"));
  items.push({ type: "separator" }, { text: "Refresh  ⌘R", action: run("refresh") });
  return items;
};
export const confirmSheet = (row: Row, op: string): Json => ({
  sheet: {
    id: "confirmSheet",
    closeonescape: true,
    root: {
      type: "view",
      layout: "inline",
      direction: "vertical",
      padding: 24,
      spacing: 18,
      components: [
        {
          type: "label",
          text: op === "trash-force" ? "Force remove repository?" : `${op.replaceAll("-", " ")}?`,
          font: { size: 18, weight: "semibold" },
        },
        { type: "label", text: row.title, font: { size: 14 } },
        {
          type: "label",
          text:
            op === "trash-force"
              ? "Moves the folder to Trash, including uncommitted files and unpushed commits."
              : op === "trash"
                ? "Checks for local changes and unpushed commits, then moves the folder to Trash."
                : "This action changes GitHub state. Confirm to continue.",
        },
        {
          type: "button",
          text: "Confirm",
          shortcut: "⌘↩",
          events: [{ triggers: "actioned", action: run("execute", [op, row.id]) }],
        },
        {
          type: "button",
          text: "Back  {var:back_label}",
          shortcut: "{var:back_shortcut}",
          events: [
            {
              triggers: "actioned",
              action: json({
                sheet: { close: "confirmSheet" },
              }),
            },
          ],
        },
      ],
    },
  },
});
