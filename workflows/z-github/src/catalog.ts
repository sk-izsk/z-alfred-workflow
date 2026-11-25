import type { Mode } from "./model.ts";
export const COMMANDS: {
  id: string;
  title: string;
  description: string;
  mode?: Mode;
  form?: string;
  repo?: boolean;
}[] = [
  {
    id: "repos",
    title: "Search Repositories",
    description: "Find public and private GitHub repositories",
    mode: "repos",
  },
  {
    id: "local",
    title: "List Local Git Repositories",
    description: "Find local repositories, favorites, worktrees and submodules",
    mode: "local",
  },
  {
    id: "my-prs",
    title: "My Pull Requests",
    description: "Your PRs across repositories, including full closed and merged history",
    mode: "my-prs",
  },
  {
    id: "prs",
    title: "Search Pull Requests",
    description: "Search PRs by title, author, repository or GitHub qualifiers",
    mode: "prs",
  },
  {
    id: "create-pr",
    title: "Create Pull Request",
    description: "Choose repository, head/base branches and draft/auto-merge options",
    form: "create-pr",
  },
  {
    id: "my-issues",
    title: "My Issues",
    description: "Created, assigned and mentioned issues",
    mode: "my-issues",
  },
  {
    id: "issues",
    title: "Search Issues",
    description: "Search GitHub issues across repositories",
    mode: "issues",
  },
  {
    id: "create-issue",
    title: "Create Issue",
    description: "Create an issue with labels and assignees",
    form: "create-issue",
  },
  {
    id: "create-branch",
    title: "Create Branch",
    description: "Create a branch, optionally linked to an issue",
    form: "create-branch",
  },
  {
    id: "create-release",
    title: "Create Release",
    description: "Publish a draft, prerelease or regular release",
    form: "create-release",
  },
  {
    id: "create-repo",
    title: "Create Repository",
    description: "Create a repository in your account or organization",
    form: "create-repo",
  },
  {
    id: "latest",
    title: "My Latest Repositories",
    description: "Your repositories by most recently pushed",
    mode: "latest",
  },
  {
    id: "starred",
    title: "My Starred Repositories",
    description: "Browse repositories you starred",
    mode: "starred",
  },
  {
    id: "runs",
    title: "Workflow Runs",
    description: "Browse, rerun, cancel and delete Actions runs",
    mode: "runs",
    repo: true,
  },
  {
    id: "dispatch",
    title: "Dispatch Workflow",
    description: "Choose a workflow, ref and workflow_dispatch inputs",
    form: "dispatch",
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Unread and read notifications, filtered by repository",
    mode: "notifications",
  },
  {
    id: "discussions",
    title: "Search Discussions",
    description: "Search GitHub discussions",
    mode: "discussions",
  },
  {
    id: "my-discussions",
    title: "My Discussions",
    description: "Discussions you created or participated in",
    mode: "my-discussions",
  },
  {
    id: "projects",
    title: "My Projects",
    description: "View, close or reopen GitHub Projects",
    mode: "projects",
  },
  {
    id: "packages",
    title: "My Packages",
    description: "Browse package types, versions and installation commands",
    mode: "packages",
  },
  {
    id: "stats",
    title: "My GitHub Stats",
    description: "Profile statistics, organizations, activity and API rate limits",
    mode: "stats",
  },
  {
    id: "clone",
    title: "Clone Repository",
    description: "Clone any HTTPS/SSH Git repository into a chosen folder",
    form: "clone",
  },
  {
    id: "remove",
    title: "Remove Local Repository",
    description: "Move a repository to Trash with clean/unpushed checks",
    mode: "local",
  },
  {
    id: "download",
    title: "Download Repository as ZIP",
    description: "Download a branch or directory archive",
    form: "download",
  },
];
