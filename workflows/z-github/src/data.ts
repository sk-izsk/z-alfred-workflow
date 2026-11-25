import { api, graphql, hostname, viewer, allPages } from "./api.ts";
import { array, object, text, num, repoName, type View, type Row, type Json } from "./model.ts";
import { scan } from "./local.ts";
import { str } from "./env.ts";
const pageSize = 50;
const queryParams = (values: Record<string, string | number>) =>
  new URLSearchParams(Object.fromEntries(Object.entries(values).map(([k, v]) => [k, String(v)]))).toString();
export const searchQuery = (v: View, kind: "pr" | "issue" | "discussion"): string => {
  const terms = [`is:${kind}`];
  if (v.repo) terms.push(`repo:${repoName(v.repo)}`);
  if (v.mode.startsWith("my-")) {
    const relations: Record<string, string> = {
      created: "author:@me",
      assigned: "assignee:@me",
      mentioned: "mentions:@me",
      review: "review-requested:@me",
      reviewed: "reviewed-by:@me",
      involved: "involves:@me",
    };
    terms.push(relations[v.relation] || relations.created!);
  }
  const states: Record<string, string> = {
    open: "is:open",
    closed: kind === "pr" ? "is:closed -is:merged" : "is:closed",
    merged: "is:merged",
    draft: "is:open draft:true",
    all: "",
  };
  terms.push(states[v.status] ?? "", v.query);
  return terms.filter(Boolean).join(" ");
};
const days = (value: unknown): string => {
  const date = Date.parse(text(value));
  if (!Number.isFinite(date)) return "";
  const d = Math.max(0, Math.floor((Date.now() - date) / 86400000));
  return d ? `${d}d` : "today";
};
export const repositoryRow = (r: Json): Row => ({
  id: text(r.node_id) || text(r.id) || text(r.full_name),
  kind: "repo",
  title: text(r.full_name) || text(r.nameWithOwner),
  subtitle: text(r.description),
  accessory: `★ ${num(r.stargazers_count)}  ${text(r.language)} · ${days(r.pushed_at)}`,
  repo: text(r.full_name) || text(r.nameWithOwner),
  url: text(r.html_url) || text(r.url),
  icon: r.private ? "lock" : "building.2",
  raw: r,
});
export const issueRow = (r: Json, kind: "pr" | "issue"): Row => {
  const url = text(r.html_url) || text(r.url);
  const parts = url.split("/");
  const repo = parts.slice(3, 5).join("/");
  const merged = !!object(r.pull_request).merged_at || !!r.merged_at,
    draft = !!r.draft;
  const closed = text(r.state) === "closed" || text(r.state) === "CLOSED";
  const status = merged ? "merged" : draft ? "draft" : closed ? "closed" : "open";
  return {
    id: text(r.node_id) || text(r.id) || url,
    title: text(r.title),
    subtitle: `#${text(r.number)} · ${repo} · ${text(object(r.user).login) || text(object(r.author).login)}`,
    accessory: `${status} · ${days(r.updated_at)}`,
    kind,
    repo,
    url,
    icon: `github/${kind === "pr" ? "pull-request" : "issue"}-${status === "draft" && kind === "issue" ? "open" : status}.svg`,
    colour: merged
      ? "systemPurpleColor"
      : draft
        ? "secondaryLabelColor"
        : closed
          ? "systemRedColor"
          : "systemGreenColor",
    raw: r,
  };
};
export const runRow = (r: Json, repo: string): Row => ({
  id: text(r.id),
  kind: "run",
  repo,
  title: `${text(r.name)}: ${text(r.display_title)}`,
  subtitle: text(r.head_branch),
  accessory: `${text(r.conclusion) || text(r.status)} · ${text(r.head_sha).slice(0, 7)}`,
  url: text(r.html_url),
  icon:
    r.conclusion === "success" ? "checkmark.circle" : r.conclusion === "failure" ? "xmark.circle" : "clock",
  colour:
    r.conclusion === "success"
      ? "systemGreenColor"
      : r.conclusion === "failure"
        ? "systemRedColor"
        : "secondaryLabelColor",
  raw: r,
});
const restList = async (endpoint: string, page: number, fresh: boolean): Promise<Json[]> =>
  array(
    await api(
      `${endpoint}${endpoint.includes("?") ? "&" : "?"}per_page=${pageSize}&page=${page}`,
      "GET",
      undefined,
      fresh,
    ),
  );
export const repoOptions = async (): Promise<{ text: string; value: string }[]> =>
  (await allPages("user/repos?sort=pushed")).map((r) => ({
    text: text(r.full_name),
    value: text(r.full_name),
  }));
const requireRepo = (v: View): string => repoName(v.repo);
export const loadData = async (v: View, fresh = false): Promise<View> => {
  let rows: Row[] = [],
    more = false,
    notice = "";
  const page = v.page;
  switch (v.mode) {
    case "local": {
      rows = (await scan()).filter(
        (r) =>
          (v.status === "all" || v.status === "open" || r.raw.type === v.status) &&
          (!v.query ||
            `${r.title} ${str("local_search_path", "1") === "1" ? r.path : ""}`
              .toLowerCase()
              .includes(v.query.toLowerCase())),
      );
      break;
    }
    case "repos": {
      const me = await viewer();
      const q = v.query || `user:${text(me.login)}`;
      const result = object(
        await api(
          "search/repositories?" + queryParams({ q, sort: v.sort, order: "desc", per_page: pageSize, page }),
          "GET",
          undefined,
          fresh,
        ),
      );
      rows = array(result.items).map(repositoryRow);
      more = page * pageSize < Math.min(1000, num(result.total_count));
      if (num(result.total_count) > 1000)
        notice = "GitHub search exposes at most 1,000 results per query. Add qualifiers to narrow it.";
      break;
    }
    case "latest":
    case "starred": {
      const list = await restList(
        v.mode === "latest" ? "user/repos?sort=pushed" : "user/starred?sort=updated",
        page,
        fresh,
      );
      rows = list.map(repositoryRow);
      more = list.length === pageSize;
      break;
    }
    case "my-prs":
    case "prs":
    case "my-issues":
    case "issues": {
      const kind = v.mode.endsWith("prs") ? "pr" : "issue";
      const q = searchQuery(v, kind);
      const result = object(
        await api(
          "search/issues?" + queryParams({ q, sort: v.sort, order: "desc", per_page: pageSize, page }),
          "GET",
          undefined,
          fresh,
        ),
      );
      rows = array(result.items).map((r) => issueRow(r, kind));
      more = page * pageSize < Math.min(1000, num(result.total_count));
      if (num(result.total_count) > 1000)
        notice = "GitHub search caps each query at 1,000 results. Narrow by repository or date.";
      break;
    }
    case "notifications": {
      const q = queryParams({ all: v.status === "unread" ? "false" : "true", per_page: pageSize, page });
      const list = array(
        await api(
          (v.repo ? `repos/${repoName(v.repo)}/notifications` : "notifications") + "?" + q,
          "GET",
          undefined,
          fresh,
        ),
      );
      rows = list.map((r) => {
        const sub = object(r.subject),
          repo = text(object(r.repository).full_name);
        const link = text(sub.url);
        const number = link.split("/").pop();
        const type = text(sub.type);
        const url =
          type === "PullRequest"
            ? `https://${hostname()}/${repo}/pull/${number}`
            : type === "Issue"
              ? `https://${hostname()}/${repo}/issues/${number}`
              : `https://${hostname()}/${repo}`;
        return {
          id: text(r.id),
          kind: "notification",
          repo,
          title: text(sub.title),
          subtitle: `${r.unread ? "Unread" : "Read"} · ${repo} · ${text(r.reason)}`,
          accessory: days(r.updated_at),
          url,
          icon: type === "PullRequest" ? "github/pull-request-open.svg" : "github/issue-open.svg",
          raw: r,
        };
      });
      more = list.length === pageSize;
      break;
    }
    case "runs": {
      const repo = requireRepo(v),
        result = object(
          await api(`repos/${repo}/actions/runs?per_page=${pageSize}&page=${page}`, "GET", undefined, fresh),
        );
      rows = array(result.workflow_runs).map((r) => runRow(r, repo));
      if (v.query)
        rows = rows.filter((r) =>
          `${r.title} ${r.subtitle} ${r.accessory}`.toLowerCase().includes(v.query.toLowerCase()),
        );
      more = page * pageSize < num(result.total_count);
      break;
    }
    case "workflows": {
      const repo = requireRepo(v),
        result = object(
          await api(
            `repos/${repo}/actions/workflows?per_page=${pageSize}&page=${page}`,
            "GET",
            undefined,
            fresh,
          ),
        );
      rows = array(result.workflows).map((r) => ({
        id: text(r.id),
        kind: "workflow",
        repo,
        title: text(r.name),
        subtitle: text(r.path),
        accessory: text(r.state),
        url: text(r.html_url),
        icon: "play.circle",
        raw: r,
      }));
      more = page * pageSize < num(result.total_count);
      break;
    }
    case "releases": {
      const repo = requireRepo(v),
        list = await restList(`repos/${repo}/releases`, page, fresh);
      rows = list.map((r) => ({
        id: text(r.id),
        kind: "release",
        repo,
        title: text(r.name) || text(r.tag_name),
        subtitle: text(r.tag_name),
        accessory: r.draft ? "Draft" : r.prerelease ? "Prerelease" : days(r.published_at),
        url: text(r.html_url),
        icon: "github/tag.svg",
        raw: r,
      }));
      more = list.length === pageSize;
      break;
    }
    case "discussions":
    case "my-discussions": {
      const cursorKey = `cursor${page - 1}`;
      const query = searchQuery(v, "discussion");
      const data = await graphql(
        "query($q:String!,$after:String){search(query:$q,type:DISCUSSION,first:50,after:$after){discussionCount pageInfo{hasNextPage endCursor} nodes{... on Discussion{id number title body url updatedAt author{login} repository{nameWithOwner} category{name} comments{totalCount}}}}}",
        { q: query, after: page > 1 ? text((v as unknown as Json)[cursorKey]) : null },
      );
      const result = object(data.search);
      rows = array(result.nodes).map((r) => ({
        id: text(r.id),
        kind: "discussion",
        repo: text(object(r.repository).nameWithOwner),
        title: text(r.title),
        subtitle: `#${text(r.number)} · ${text(object(r.repository).nameWithOwner)} · ${text(object(r.author).login)}`,
        accessory: days(r.updatedAt),
        url: text(r.url),
        icon: "github/comment-discussion.svg",
        raw: r,
      }));
      more = !!object(result.pageInfo).hasNextPage;
      (v as unknown as Json)[`cursor${page}`] = object(result.pageInfo).endCursor;
      break;
    }
    case "projects": {
      const owner = v.owner || text((await viewer()).login);
      const data = await graphql(
        "query($owner:String!,$after:String){repositoryOwner(login:$owner){... on User{projectsV2(first:50,after:$after){nodes{id title number url closed shortDescription readme public updatedAt} pageInfo{hasNextPage endCursor}}} ... on Organization{projectsV2(first:50,after:$after){nodes{id title number url closed shortDescription readme public updatedAt} pageInfo{hasNextPage endCursor}}}}}",
        { owner, after: page > 1 ? text((v as unknown as Json)[`cursor${page - 1}`]) : null },
      );
      const result = object(object(data.repositoryOwner).projectsV2);
      rows = array(result.nodes)
        .filter((r) => v.status === "all" || (v.status === "closed" ? !!r.closed : !r.closed))
        .map((r) => ({
          id: text(r.id),
          kind: "project",
          title: text(r.title),
          subtitle: text(r.shortDescription),
          accessory: r.closed ? "Closed" : "Open",
          url: text(r.url),
          icon: "github/project.svg",
          raw: { ...r, owner },
        }));
      more = !!object(result.pageInfo).hasNextPage;
      (v as unknown as Json)[`cursor${page}`] = object(result.pageInfo).endCursor;
      break;
    }
    case "packages": {
      const types =
        v.status === "all" || v.status === "open"
          ? ["container", "npm", "maven", "docker", "nuget", "rubygems"]
          : [v.status];
      const results = await Promise.all(
        types.map(async (type) => {
          const list = await restList(`user/packages?package_type=${type}`, page, fresh);
          if (list.length === pageSize) more = true;
          return list.map((r) => ({
            id: text(r.id),
            kind: "package" as const,
            title: text(r.name),
            subtitle: `${text(r.package_type)} · ${text(r.visibility)}`,
            accessory: `${text(r.version_count)} versions`,
            url: text(r.html_url),
            repo: text(object(r.repository).full_name),
            icon: "shippingbox",
            raw: r,
          }));
        }),
      );
      rows = results.flat();
      break;
    }
    case "versions": {
      const owner = v.owner || text((await viewer()).login),
        type = v.packageType || "container",
        name = encodeURIComponent(v.packageName || "");
      const list = await restList(`users/${owner}/packages/${type}/${name}/versions`, page, fresh);
      rows = list.map((r) => ({
        id: text(r.id),
        kind: "version",
        title: text(r.name),
        subtitle: ((object(object(r.metadata).container).tags as string[] | undefined) || []).join(", "),
        accessory: days(r.updated_at),
        url: text(r.html_url) || text(r.package_html_url),
        icon: "shippingbox",
        raw: r,
      }));
      more = list.length === pageSize;
      break;
    }
    case "stats": {
      const me = await viewer(),
        rate = object(await api("rate_limit", "GET", undefined, fresh)),
        orgs = await restList("user/orgs", 1, fresh);
      rows = [
        ["Profile", `${text(me.name) || text(me.login)} (@${text(me.login)})`, text(me.html_url)],
        ["Followers", String(num(me.followers)), text(me.html_url) + "?tab=followers"],
        ["Following", String(num(me.following)), text(me.html_url) + "?tab=following"],
        ["Public repositories", String(num(me.public_repos)), text(me.html_url) + "?tab=repositories"],
        [
          "API rate limit",
          `${num(object(rate.rate).remaining)} / ${num(object(rate.rate).limit)}`,
          `https://${hostname()}/settings/tokens`,
        ],
      ].map(([title, value, url]) => ({
        id: title!,
        kind: "stat",
        title: title!,
        subtitle: value!,
        accessory: "",
        url: url!,
        icon: "chart.bar",
        raw: me,
      }));
      rows.push(
        ...orgs.map((r) => ({
          id: text(r.id),
          kind: "stat" as const,
          title: text(r.login),
          subtitle: "Organization",
          accessory: "",
          url: `https://${hostname()}/${text(r.login)}`,
          icon: "building.2",
          raw: r,
        })),
      );
      break;
    }
  }
  const allowed = str("repository_filter", "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length && v.mode !== "local") rows = rows.filter((r) => !r.repo || allowed.includes(r.repo));
  return { ...v, rows, more, notice };
};
