import { existsSync, mkdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { api, graphql, hostname, viewer } from "./api.ts";
import { gh, git, command, downloadAPI } from "./proc.ts";
import { clone, openLocal, trash } from "./local.ts";
import { dataDir } from "./env.ts";
import { array, object, text, repoName, type Row, type Json, type FormState } from "./model.ts";
import { csv, validateForm } from "./forms.ts";
const expand = (p: string) => (p === "~" ? homedir() : p.startsWith("~/") ? join(homedir(), p.slice(2)) : p);
const encode = (s: string) => encodeURIComponent(s);
export const MUTATIONS = new Set([
  "star",
  "unstar",
  "assign-me",
  "unassign-me",
  "ready",
  "merge-merge",
  "merge-squash",
  "merge-rebase",
  "auto-merge",
  "auto-squash",
  "auto-rebase",
  "disable-auto",
  "enqueue",
  "dequeue",
  "close",
  "reopen",
  "close-completed",
  "close-not-planned",
  "rerun",
  "rerun-failed",
  "cancel-run",
  "delete-run",
  "notification-read",
  "notifications-read-all",
  "notification-done",
  "notification-unsubscribe",
  "accept-invitation",
  "project-close",
  "project-reopen",
  "issue-delete-branch",
  "trash",
  "trash-force",
]);
export const mutate = async (op: string, row: Row): Promise<void> => {
  if (!MUTATIONS.has(op)) throw new Error("Unknown operation.");
  const repo = row.repo ? repoName(row.repo) : "",
    n = text(row.raw.number);
  if (op === "trash" || op === "trash-force") {
    await trash(row.path || "", op === "trash-force");
    return;
  }
  if (op === "star" || op === "unstar") {
    await api(`user/starred/${repo}`, op === "star" ? "PUT" : "DELETE");
    return;
  }
  if (["assign-me", "unassign-me"].includes(op)) {
    await api(`repos/${repo}/issues/${n}/assignees`, op === "assign-me" ? "POST" : "DELETE", {
      assignees: [text((await viewer()).login)],
    });
    return;
  }
  if (op === "close" || op === "reopen" || op.startsWith("close-")) {
    await api(`repos/${repo}/issues/${n}`, "PATCH", {
      state: op === "reopen" ? "open" : "closed",
      ...(op === "close-not-planned"
        ? { state_reason: "not_planned" }
        : op === "close-completed"
          ? { state_reason: "completed" }
          : {}),
    });
    return;
  }
  if (op.startsWith("merge-")) {
    await api(`repos/${repo}/pulls/${n}/merge`, "PUT", {
      merge_method: op.slice(6),
      sha: text(object(row.raw.head).sha),
    });
    return;
  }
  if (op.startsWith("auto-")) {
    await gh(["pr", "merge", n, "--repo", repo, "--auto", "--" + op.slice(5)]);
    return;
  }
  if (op === "disable-auto") {
    await gh(["pr", "merge", n, "--repo", repo, "--disable-auto"]);
    return;
  }
  if (op === "ready") {
    await graphql(
      "mutation($id:ID!){markPullRequestReadyForReview(input:{pullRequestId:$id}){pullRequest{id}}}",
      { id: text(row.raw.node_id) },
    );
    return;
  }
  if (op === "enqueue" || op === "dequeue") {
    const name = op === "enqueue" ? "enqueuePullRequest" : "dequeuePullRequest";
    await graphql(`mutation($id:ID!){${name}(input:{pullRequestId:$id}){clientMutationId}}`, {
      id: text(row.raw.node_id),
    });
    return;
  }
  const runOps: Record<string, [string, string]> = {
    rerun: ["rerun", "POST"],
    "rerun-failed": ["rerun-failed-jobs", "POST"],
    "cancel-run": ["cancel", "POST"],
    "delete-run": ["", "DELETE"],
  };
  if (runOps[op]) {
    const [suffix, method] = runOps[op]!;
    await api(`repos/${repo}/actions/runs/${row.id}${suffix ? "/" + suffix : ""}`, method);
    return;
  }
  if (op === "notification-read" || op === "notification-done") {
    await api(`notifications/threads/${row.id}`, op === "notification-read" ? "PATCH" : "DELETE");
    return;
  }
  if (op === "notifications-read-all") {
    await api("notifications", "PUT", { read: true });
    return;
  }
  if (op === "notification-unsubscribe") {
    await api(`notifications/threads/${row.id}/subscription`, "PUT", { ignored: true });
    return;
  }
  if (op === "accept-invitation") {
    const invitations = array(await api("user/repository_invitations", "GET", undefined, true));
    const invite = invitations.find((i) => text(object(i.repository).full_name) === repo);
    if (!invite) throw new Error("No matching repository invitation was found.");
    await api(`user/repository_invitations/${text(invite.id)}`, "PATCH");
    return;
  }
  if (op === "project-close" || op === "project-reopen") {
    await graphql(
      "mutation($id:ID!,$closed:Boolean!){updateProjectV2(input:{projectId:$id,closed:$closed}){projectV2{id}}}",
      { id: row.id, closed: op === "project-close" },
    );
    return;
  }
  if (op === "issue-delete-branch") {
    const data = await graphql(
      "query($id:ID!){node(id:$id){... on Issue{linkedBranches(first:100){nodes{ref{name repository{nameWithOwner defaultBranchRef{name}}}}}}}}",
      { id: text(row.raw.node_id) },
    );
    const refs = array(object(object(data.node).linkedBranches).nodes).map((v) => object(v.ref));
    if (refs.length !== 1)
      throw new Error(
        "The issue must have exactly one linked branch. Open GitHub to choose among multiple branches.",
      );
    const ref = refs[0]!,
      repository = object(ref.repository);
    if (text(ref.name) === text(object(repository.defaultBranchRef).name))
      throw new Error("The default branch cannot be deleted.");
    await api(
      `repos/${repoName(text(repository.nameWithOwner))}/git/refs/heads/${encode(text(ref.name))}`,
      "DELETE",
    );
    return;
  }
};
export const rowDetail = async (row: Row): Promise<string> => {
  const r = row.raw;
  let body = text(r.body) || text(r.readme) || text(r.description) || text(r.shortDescription);
  if (row.kind === "pr" || row.kind === "issue") {
    const d = object(
      await api(
        `repos/${row.repo}/${row.kind === "pr" ? "pulls" : "issues"}/${text(r.number)}`,
        "GET",
        undefined,
        true,
      ),
    );
    row.raw = { ...r, ...d };
    body = text(d.body);
    if (row.kind === "pr") {
      const checks = object(await api(`repos/${row.repo}/commits/${text(object(d.head).sha)}/check-runs`));
      body += `\n\n## Checks\n${array(checks.check_runs)
        .map((c) => `- ${text(c.name)}: ${text(c.conclusion) || text(c.status)}`)
        .join("\n")}`;
    }
    const comments = array(await api(`repos/${row.repo}/issues/${text(r.number)}/comments?per_page=100`));
    body += `\n\n## Comments\n${comments.map((c) => `### ${text(object(c.user).login)}\n${text(c.body)}`).join("\n\n")}`;
  }
  return `# ${row.title}\n\n${row.subtitle}\n\n${body}\n\n${row.url ? `[Open in GitHub](${row.url})` : ""}`;
};
export const readme = async (row: Row): Promise<string> => {
  const r = object(await api(`repos/${repoName(row.repo || "")}/readme`));
  return Buffer.from(text(r.content).replaceAll("\n", ""), "base64").toString("utf8");
};
export const formSubmit = async (
  form: FormState,
): Promise<{ url?: string; message: string; path?: string }> => {
  validateForm(form);
  const v = form.values,
    row = form.row;
  const repo = v.repository ? repoName(v.repository) : row?.repo ? repoName(row.repo) : "";
  const body = v.body || "";
  let result: Json = {};
  switch (form.action) {
    case "create-repo": {
      if (!/^[\w.-]+$/.test(v.name || "")) throw new Error("Repository name is invalid.");
      const me = text((await viewer()).login),
        owner = v.owner || me;
      result = object(
        await api(owner === me ? "user/repos" : `orgs/${encode(owner)}/repos`, "POST", {
          name: v.name,
          description: v.description || "",
          private: ["1", "true"].includes(v.private || ""),
          auto_init: ["1", "true"].includes(v.readme || ""),
        }),
      );
      break;
    }
    case "create-pr": {
      if (v.head === v.base) throw new Error("From and Into branches must differ.");
      result = object(
        await api(`repos/${repo}/pulls`, "POST", {
          title: v.title,
          body,
          head: v.head,
          base: v.base,
          draft: ["1", "true"].includes(v.draft || ""),
        }),
      );
      const made: Row = {
        id: text(result.id),
        title: text(result.title),
        subtitle: "",
        accessory: "",
        kind: "pr",
        repo,
        icon: "",
        url: text(result.html_url),
        raw: result,
      };
      const pending: Promise<unknown>[] = [];
      if (v.labels || v.assignees)
        pending.push(
          api(`repos/${repo}/issues/${text(result.number)}`, "PATCH", {
            ...(v.labels ? { labels: csv(v.labels) } : {}),
            ...(v.assignees ? { assignees: csv(v.assignees) } : {}),
          }),
        );
      if (v.reviewers) pending.push(requestReview(repo, text(result.number), csv(v.reviewers)));
      try {
        await Promise.all(pending);
        if (v.auto === "1" || v.auto === "true")
          await gh([
            "pr",
            "merge",
            text(result.number),
            "--repo",
            repo,
            "--auto",
            "--" + (v.method || "SQUASH").toLowerCase(),
          ]);
        await applyProjects(v.projects || "", text(result.html_url));
        if (v.milestone)
          await api(`repos/${repo}/issues/${text(result.number)}`, "PATCH", {
            milestone: Number(v.milestone),
          });
      } catch (error) {
        throw new Error(
          `PR was created: ${made.url}. Some follow-up settings failed: ${String(error)}. Do not submit again.`,
          { cause: error },
        );
      }
      break;
    }
    case "create-issue": {
      result = object(
        await api(`repos/${repo}/issues`, "POST", {
          title: v.title,
          body,
          assignees: csv(v.assignees),
          labels: csv(v.labels),
          ...(v.milestone ? { milestone: Number(v.milestone) } : {}),
          ...(v.issueType ? { type: v.issueType } : {}),
        }),
      );
      try {
        await applyProjects(v.projects || "", text(result.html_url));
      } catch (error) {
        throw new Error(
          `Issue was created: ${text(result.html_url)}. Adding to projects failed: ${String(error)}. Do not submit again.`,
          { cause: error },
        );
      }
      break;
    }
    case "create-branch": {
      await git(["check-ref-format", "--branch", v.name || ""]);
      const ref = object(await api(`repos/${repo}/git/ref/heads/${encode(v.base || "main")}`));
      const sha = text(object(ref.object).sha);
      if (v.issue) {
        const r = object(await api(`repos/${repo}`));
        await graphql(
          "mutation($issue:ID!,$repository:ID!,$name:String!,$oid:GitObjectID!){createLinkedBranch(input:{issueId:$issue,repositoryId:$repository,name:$name,oid:$oid}){linkedBranch{id}}}",
          { issue: v.issue, repository: text(r.node_id), name: v.name, oid: sha },
        );
      } else await api(`repos/${repo}/git/refs`, "POST", { ref: `refs/heads/${v.name}`, sha });
      return { message: "Branch created", url: `https://${hostname()}/${repo}/tree/${encode(v.name || "")}` };
    }
    case "create-release":
      result = object(
        await api(`repos/${repo}/releases`, "POST", {
          tag_name: v.tag,
          name: v.title || v.tag,
          target_commitish: v.target,
          body,
          draft: ["1", "true"].includes(v.draft || ""),
          prerelease: ["1", "true"].includes(v.prerelease || ""),
          generate_release_notes: ["1", "true"].includes(v.generate || ""),
        }),
      );
      break;
    case "dispatch": {
      const inputs = v.inputs?.trim() ? JSON.parse(v.inputs) : {};
      if (!inputs || typeof inputs !== "object" || Array.isArray(inputs))
        throw new Error("Inputs must be a JSON object.");
      await api(`repos/${repo}/actions/workflows/${encode(v.workflow || "")}/dispatches`, "POST", {
        ref: v.ref,
        inputs,
      });
      return { message: "Workflow dispatched", url: `https://${hostname()}/${repo}/actions` };
    }
    case "clone": {
      const path = await clone(v.url || "", v.parent || "", v.name || "");
      if (v.application) await command("/usr/bin/open", ["-a", v.application, path]);
      return { message: "Cloned repository", path };
    }
    case "checkout": {
      if (!row) throw new Error("No pull request selected.");
      const parent = expand(v.parent || "");
      const target = join(parent, repo.split("/")[1]!);
      if (!existsSync(target)) await clone(`https://${hostname()}/${repo}.git`, parent);
      if (await git(["status", "--porcelain", "--untracked-files=all"], target))
        throw new Error("Local checkout has changes. Commit or stash them before checking out the PR.");
      await gh(["pr", "checkout", text(row.raw.number), "--repo", repo], "", target);
      if (v.application) await command("/usr/bin/open", ["-a", v.application, target]);
      return { message: "Checked out pull request", path: target };
    }
    case "review":
      await api(`repos/${repo}/pulls/${text(row?.raw.number)}/reviews`, "POST", { body, event: v.event });
      return { message: "Review submitted" };
    case "comment":
      if (!body.trim()) throw new Error("Comment cannot be empty.");
      await api(`repos/${repo}/issues/${text(row?.raw.number)}/comments`, "POST", { body });
      return { message: "Comment added" };
    case "metadata": {
      const n = text(row?.raw.number);
      if (v.assignees)
        await api(`repos/${repo}/issues/${n}/assignees`, "POST", { assignees: csv(v.assignees) });
      if (v.removeAssignees)
        await api(`repos/${repo}/issues/${n}/assignees`, "DELETE", { assignees: csv(v.removeAssignees) });
      if (v.labels) await api(`repos/${repo}/issues/${n}/labels`, "POST", { labels: csv(v.labels) });
      for (const label of csv(v.removeLabels))
        await api(`repos/${repo}/issues/${n}/labels/${encode(label)}`, "DELETE");
      return { message: "Labels and assignees updated" };
    }
    case "reviewers":
      await requestReview(repo, text(row?.raw.number), csv(v.reviewers));
      return { message: "Review requested" };
    case "project":
      await gh([
        "project",
        "item-add",
        String(positive(v.number || "")),
        "--owner",
        v.owner || "",
        "--url",
        row?.url || "",
      ]);
      return { message: "Added to project" };
    case "milestone":
      await api(`repos/${repo}/issues/${text(row?.raw.number)}`, "PATCH", {
        milestone: v.milestone ? positive(v.milestone) : null,
      });
      return { message: "Milestone updated" };
    case "issueType":
      await api(`repos/${repo}/issues/${text(row?.raw.number)}`, "PATCH", { type: v.issueType });
      return { message: "Issue type updated" };
    case "openwith":
      await openLocal(row?.path || "", v.application || "");
      return { message: "Opened repository" };
    case "download":
      return download(repo, v.ref || "main", v.directory || "", v.destination || "~/Downloads");
    default:
      throw new Error("Unsupported submission.");
  }
  return { message: `${form.title} completed`, url: text(result.html_url) };
};
const positive = (s: string): number => {
  if (!/^\d+$/.test(s) || Number(s) < 1) throw new Error("Enter a positive number.");
  return Number(s);
};
const requestReview = (repo: string, n: string, reviewers: string[]) =>
  api(`repos/${repo}/pulls/${n}/requested_reviewers`, "POST", {
    reviewers: reviewers.filter((u) => !u.includes("/")),
    team_reviewers: reviewers.filter((u) => u.includes("/")).map((u) => u.split("/")[1]),
  });
const applyProjects = async (value: string, url: string): Promise<void> => {
  for (const p of csv(value)) {
    const parts = p.split("/");
    if (parts.length !== 2) throw new Error("Use owner/project-number for projects.");
    await gh(["project", "item-add", String(positive(parts[1]!)), "--owner", parts[0]!, "--url", url]);
  }
};
const download = async (
  repo: string,
  ref: string,
  directory: string,
  destination: string,
): Promise<{ message: string; path: string }> => {
  const dir = resolve(expand(destination));
  if (!existsSync(dir)) throw new Error("Save folder does not exist.");
  const name = `${repo.replace("/", "-")}-${ref.replace(/[^a-zA-Z0-9_.-]/g, "-")}-${Date.now()}`;
  const target = join(dir, name + ".zip");
  // gh supplies authentication and follows GitHub's archive redirect without exposing a token.
  await downloadAPI(`repos/${repo}/zipball/${encode(ref)}`, target, hostname());
  if (directory) {
    if (directory.split("/").some((s) => s === "..") || directory.startsWith("/"))
      throw new Error("Invalid directory path.");
    const tmp = join(dataDir(), `archive-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    try {
      // ditto preserves directory structure; GitHub's own archive has one repository root.
      await command("/usr/bin/tar", ["-xf", target, "-C", tmp]);
      const { readdirSync } = await import("node:fs");
      const root = readdirSync(tmp)[0];
      if (!root) throw new Error("Archive is empty.");
      const picked = join(tmp, root, directory);
      if (!existsSync(picked)) throw new Error("Directory is not present in this ref.");
      const subset = join(dir, name + "-directory.zip");
      await command("/usr/bin/ditto", ["-c", "-k", "--keepParent", picked, subset]);
      rmSync(target, { force: true });
      return { message: "Directory ZIP downloaded", path: subset };
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }
  return { message: "ZIP downloaded", path: target };
};
