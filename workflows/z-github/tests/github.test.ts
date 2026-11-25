import { afterAll, beforeAll, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { downloadAPI } from "../src/proc.ts";
import { api } from "../src/api.ts";
import { newView, repoName, safeURL, type Row, type Mode } from "../src/model.ts";
import { loadData, searchQuery } from "../src/data.ts";
import { buildForm } from "../src/forms.ts";
import { rowMenu } from "../src/actions.ts";
import { mutate } from "../src/operations.ts";
import { remoteURL, scan, removalCheck } from "../src/local.ts";
import { create, save, read, beginRequest, current } from "../src/store.ts";
import { formSheet } from "../ui/window.ts";
const root = mkdtempSync(join(tmpdir(), "github-tests-")),
  log = join(root, "requests.jsonl"),
  fake = join(root, "gh.mjs");
const repo = {
  id: 1,
  node_id: "R_demo",
  full_name: "example/dashboard",
  name: "dashboard",
  description: "Example project",
  html_url: "https://github.com/example/dashboard",
  default_branch: "main",
  stargazers_count: 10,
  language: "TypeScript",
};
const issue = {
  id: 2,
  node_id: "PR_demo",
  number: 42,
  title: "Add quick search",
  body: "Test",
  state: "open",
  html_url: "https://github.com/example/dashboard/pull/42",
  head: { sha: "abc123", ref: "feature/search" },
  user: { login: "example" },
  pull_request: { merged_at: null },
};
const fixture = `#!${process.execPath}
import fs from 'node:fs';
const args=process.argv.slice(2),body=args.includes('--input')?fs.readFileSync(0,'utf8'):'';fs.appendFileSync(${JSON.stringify(log)},JSON.stringify({args,body})+'\\n');
const repo=${JSON.stringify(repo)},issue=${JSON.stringify(issue)},endpoint=args[args.indexOf('--hostname')+2]||'';
let result={};
if(endpoint==='graphql') {const b=JSON.parse(body);result=b.query.includes('repositoryOwner')?{data:{repositoryOwner:{projectsV2:{nodes:[],pageInfo:{hasNextPage:false}}}}}:{data:{search:{nodes:[],pageInfo:{hasNextPage:false}}}};}
else if(endpoint==='user')result={login:'example',name:'Example User',html_url:'https://github.com/example',followers:3};
else if(endpoint.startsWith('user/repos')||endpoint.startsWith('user/starred'))result=[repo];
else if(endpoint.startsWith('user/orgs')||endpoint.startsWith('user/packages'))result=[];
else if(endpoint.startsWith('search/issues'))result={items:[issue],total_count:51};
else if(endpoint.startsWith('search/repositories'))result={items:[repo],total_count:1};
else if(endpoint.includes('/branches'))result=[{name:'main'},{name:'feature/search'}];
else if(endpoint.includes('/workflows'))result={workflows:[{id:5,name:'CI',path:'.github/workflows/ci.yml'}]};
else if(endpoint.includes('/actions/runs'))result={workflow_runs:[{id:8,name:'CI',display_title:'Test',status:'completed',conclusion:'success',head_sha:'abc123',head_branch:'main',html_url:repo.html_url+'/actions/runs/8'}],total_count:1};
else if(endpoint.includes('/pulls/42'))result=issue;
else if(endpoint.includes('/issues?'))result=[issue];
else if(endpoint.includes('notifications')||endpoint.includes('/milestones')||endpoint.includes('/releases'))result=[];
else if(endpoint==='rate_limit')result={rate:{remaining:4000,limit:5000}};
else if(endpoint==='repos/example/dashboard')result=repo;
console.log(JSON.stringify(result));
`;
const old = { ...process.env };
beforeAll(() => {
  writeFileSync(fake, fixture);
  chmodSync(fake, 0o755);
  process.env.gh_path = fake;
  process.env.alfred_workflow_cache = join(root, "cache");
  process.env.alfred_workflow_data = join(root, "data");
});
afterAll(() => {
  for (const key of [
    "gh_path",
    "alfred_workflow_cache",
    "alfred_workflow_data",
    "repo_paths",
    "scan_depth",
  ]) {
    if (old[key] === undefined) delete process.env[key];
    else process.env[key] = old[key];
  }
  rmSync(root, { recursive: true, force: true });
});
const requests = () =>
  readFileSync(log, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
const main = join(import.meta.dir, "..", "src", "main.ts");
const invoke = (cmd: string, id: string, ...args: string[]) =>
  JSON.parse(
    execFileSync(process.execPath, [main, cmd, id, ...args], {
      env: {
        HOME: process.env.HOME!,
        PATH: "/usr/bin:/bin",
        gh_path: fake,
        alfred_workflow_cache: process.env.alfred_workflow_cache!,
        alfred_workflow_data: process.env.alfred_workflow_data!,
      },
      encoding: "utf8",
    }),
  );
const prRow: Row = {
  id: "2",
  title: issue.title,
  subtitle: "",
  accessory: "",
  kind: "pr",
  repo: repo.full_name,
  url: issue.html_url,
  icon: "",
  raw: issue,
};
test("My PRs covers all dates/statuses and uses repository/relationship filters", () => {
  const v = newView("my-prs");
  expect(searchQuery(v, "pr")).toBe("is:pr author:@me");
  v.repo = "example/dashboard";
  v.status = "merged";
  expect(searchQuery(v, "pr")).toContain("repo:example/dashboard");
  expect(searchQuery(v, "pr")).toContain("is:merged");
  expect(searchQuery(v, "pr")).not.toContain("updated:");
  v.relation = "assigned";
  expect(searchQuery(v, "pr")).toContain("assignee:@me");
});
test("repository names and browser URL boundaries", () => {
  expect(() => repoName("../x")).toThrow();
  expect(() => repoName("a/b/c")).toThrow();
  expect(() => safeURL("javascript:alert(1)")).toThrow();
  expect(() => safeURL("https://github.com.evil.test/x")).toThrow();
  expect(safeURL(repo.html_url)).toBe(repo.html_url);
});
test("GET cache does not cache mutations", async () => {
  await api("user");
  await api("user");
  const before = requests().filter((r) => r.args.includes("user")).length;
  await api("user", "POST", { test: true });
  expect(requests().filter((r) => r.args.includes("user")).length).toBe(before + 1);
});
test("online list routes return structured rows and pagination", async () => {
  for (const mode of [
    "repos",
    "latest",
    "starred",
    "my-prs",
    "prs",
    "my-issues",
    "issues",
    "notifications",
    "runs",
    "workflows",
    "releases",
    "projects",
    "packages",
    "stats",
    "discussions",
    "my-discussions",
  ] as Mode[]) {
    const v = newView(mode, ["runs", "workflows", "releases"].includes(mode) ? "example/dashboard" : "");
    const result = await loadData(v, true);
    expect(result.rows).toBeArray();
    if (mode === "my-prs") expect(result.more).toBe(true);
  }
});
test("all creation forms and advanced pages build native controls", async () => {
  for (const action of [
    "create-pr",
    "create-issue",
    "create-branch",
    "create-release",
    "create-repo",
    "dispatch",
    "download",
    "clone",
    "review",
    "comment",
    "metadata",
    "reviewers",
    "project",
    "milestone",
    "checkout",
    "openwith",
    "owner",
  ]) {
    const form = await buildForm(action, prRow);
    expect(form.fields.length).toBeGreaterThan(0);
    expect(formSheet(form)).toHaveProperty("sheet");
  }
  const form = await buildForm("create-pr", prRow);
  expect(form.fields.length).toBeGreaterThan(5);
  expect(form.fields.find((f) => f.name === "head")?.options).toHaveLength(2);
});
test("repository actions include My Pull Requests without replacing the existing PR view", async () => {
  const row: Row = { ...prRow, id: "1", kind: "repo", raw: repo };
  const entries = await rowMenu(row);
  expect(entries.map((entry) => entry.text)).toContain("My Pull Requests in This Repository");
  expect(entries.map((entry) => entry.text)).toContain("All Pull Requests in This Repository");
  const menu = JSON.stringify(entries);
  expect(menu).toContain("repo-my-prs");
  expect(menu).toContain("All Pull Requests in This Repository");
  expect(menu).toContain("My Pull Requests in This Repository");
  expect(menu).toContain("form:create-pr");
  const session = create("repos");
  session.view.rows = [row];
  save(session);
  invoke("action", session.id, "repo-my-prs", row.id);
  expect(read(session.id).view.mode).toBe("my-prs");
  expect(read(session.id).view.repo).toBe(repo.full_name);
  expect(read(session.id).view.status).toBe("all");
  invoke("action", session.id, "repo-prs", "2");
  expect(read(session.id).view.mode).toBe("prs");
  expect(read(session.id).view.repo).toBe(repo.full_name);
});
test("merge pins the reviewed head and never requests an admin bypass", async () => {
  await mutate("merge-squash", prRow);
  const request = requests().at(-1);
  expect(JSON.parse(request.body)).toEqual({ merge_method: "squash", sha: "abc123" });
  expect(request.args).not.toContain("--admin");
});
test("Back exits to Alfred search from any repository view", () => {
  const s = create("my-prs");
  s.view = newView("repos", "example/dashboard");
  save(s);
  expect(invoke("back", s.id).finish.variables.github_out).toBe("back");
});
test("stale requests cannot replace newer navigation", () => {
  const s = create("repos");
  const ticket = beginRequest(s);
  beginRequest(read(s.id));
  expect(current(s, ticket)).toBe(false);
});
test("remote normalization retains nested groups and explicit ports", () => {
  expect(remoteURL("git@github.com:owner/repo.git")).toBe("https://github.com/owner/repo");
  expect(remoteURL("ssh://git@git.example.test:2222/group/sub/repo.git")).toBe(
    "https://git.example.test:2222/group/sub/repo",
  );
  expect(() => remoteURL("ext::sh bad")).toThrow();
});
test("local scanner detects repositories, worktrees and submodules and skips dependencies", async () => {
  const base = join(root, "repos");
  mkdirSync(join(base, "normal", ".git"), { recursive: true });
  mkdirSync(join(base, "worktree"), { recursive: true });
  writeFileSync(join(base, "worktree", ".git"), "gitdir: /tmp/.git/worktrees/demo");
  mkdirSync(join(base, "module"), { recursive: true });
  writeFileSync(join(base, "module", ".git"), "gitdir: /tmp/.git/modules/demo");
  mkdirSync(join(base, "node_modules", "ignored", ".git"), { recursive: true });
  process.env.repo_paths = base;
  expect((await scan()).map((r) => r.raw.type).toSorted()).toEqual(["repo", "submodule", "worktree"]);
});
test("removal refuses changes, unpushed commits and linked worktrees", async () => {
  const path = join(root, "real-repo");
  mkdirSync(path);
  process.env.repo_paths = root;
  execFileSync("/usr/bin/git", ["init", path], { stdio: "ignore" });
  writeFileSync(join(path, "file.txt"), "test");
  await expect(removalCheck(path)).rejects.toThrow("uncommitted");
  execFileSync("/usr/bin/git", ["-C", path, "add", "file.txt"]);
  execFileSync(
    "/usr/bin/git",
    ["-C", path, "-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "-m", "test"],
    { stdio: "ignore" },
  );
  await expect(removalCheck(path)).rejects.toThrow("not present");
  await expect(removalCheck(join(root, "repos", "worktree"))).rejects.toThrow("worktrees");
  expect(existsSync(path)).toBe(true);
});

test("archive downloads never replace or remove an existing destination", async () => {
  const target = join(root, "existing.zip");
  writeFileSync(target, "original");
  await expect(downloadAPI("example", target, "github.com")).rejects.toThrow();
  expect(readFileSync(target, "utf8")).toBe("original");
});
