export type Json = Record<string, unknown>;
export type Mode =
  | "repos"
  | "latest"
  | "starred"
  | "my-prs"
  | "prs"
  | "my-issues"
  | "issues"
  | "discussions"
  | "my-discussions"
  | "notifications"
  | "runs"
  | "workflows"
  | "projects"
  | "packages"
  | "versions"
  | "releases"
  | "local"
  | "stats";
export type Kind =
  | "repo"
  | "pr"
  | "issue"
  | "discussion"
  | "notification"
  | "run"
  | "workflow"
  | "project"
  | "package"
  | "version"
  | "release"
  | "local"
  | "stat";
export type Row = {
  id: string;
  title: string;
  subtitle: string;
  accessory: string;
  kind: Kind;
  repo?: string;
  url?: string;
  path?: string;
  icon: string;
  colour?: string;
  raw: Json;
};
export type View = {
  mode: Mode;
  query: string;
  repo: string;
  status: string;
  relation: string;
  sort: string;
  page: number;
  rows: Row[];
  more: boolean;
  selected: string;
  title: string;
  notice?: string;
  owner?: string;
  packageName?: string;
  packageType?: string;
};
export type Session = {
  id: string;
  view: View;
  revision: string;
  preview: boolean;
  form?: FormState;
};
export type Field = {
  name: string;
  title: string;
  value?: string;
  type?: "text" | "area" | "check" | "picker";
  options?: { text: string; value: string }[];
  placeholder?: string;
  required?: boolean;
};
export type FormState = {
  action: string;
  title: string;
  row?: Row;
  fields: Field[];
  values: Record<string, string>;
};
export const object = (value: unknown): Json =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Json) : {};
export const array = (value: unknown): Json[] => (Array.isArray(value) ? value.map(object) : []);
export const text = (value: unknown): string =>
  typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
export const num = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;
export const repoName = (value: string): string => {
  if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value) ||
    value.split("/").some((p) => p === "." || p === "..")
  )
    throw new Error("Choose a repository as owner/name.");
  return value;
};
export const TITLES: Record<Mode, string> = {
  repos: "Search Repositories",
  latest: "My Latest Repositories",
  starred: "My Starred Repositories",
  "my-prs": "My Pull Requests",
  prs: "Pull Requests",
  "my-issues": "My Issues",
  issues: "Issues",
  discussions: "Search Discussions",
  "my-discussions": "My Discussions",
  notifications: "Notifications",
  runs: "Workflow Runs",
  workflows: "Workflows",
  projects: "My Projects",
  packages: "My Packages",
  versions: "Package Versions",
  releases: "Releases",
  local: "Local Git Repositories",
  stats: "My GitHub Stats",
};
export const newView = (mode: Mode, repo = ""): View => ({
  mode,
  repo,
  query: "",
  status: mode === "my-prs" ? "all" : "open",
  relation: "created",
  sort: "updated",
  page: 1,
  rows: [],
  more: false,
  selected: "",
  title: TITLES[mode],
});
export const modes = Object.keys(TITLES) as Mode[];
export const host = (value: string): string => {
  if (!/^[A-Za-z0-9.-]+$/.test(value)) throw new Error("GitHub hostname is invalid.");
  return value;
};
export const safeURL = (value: string, hostname = "github.com"): string => {
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    ![
      hostname,
      "github.com",
      "gist.github.com",
      "github.dev",
      "gitpod.io",
      "vscode.dev",
      "sourcegraph.com",
      "deepwiki.com",
      "codesandbox.io",
      "replit.com",
      "repl.it",
      "glitch.com",
    ].includes(u.hostname)
  )
    throw new Error("This URL is not a supported GitHub or web IDE URL.");
  return u.href;
};
