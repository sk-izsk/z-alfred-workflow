import { api, viewer, allPages } from "./api.ts";
import { repoOptions } from "./data.ts";
import { scanRoots } from "./local.ts";
import { array, object, text, repoName, type Field, type FormState, type Row } from "./model.ts";
import { str } from "./env.ts";
const field = (name: string, title: string, extra: Partial<Field> = {}): Field => ({
  name,
  title,
  type: "text",
  ...extra,
});
const picker = (name: string, title: string, values: string[], value?: string): Field =>
  field(name, title, {
    type: "picker",
    options: values.map((item) => ({ text: item, value: item })),
    value: value || values[0] || "",
  });
const check = (name: string, title: string): Field => field(name, title, { type: "check", value: "0" });
const area = (name: string, title: string): Field => field(name, title, { type: "area" });
export const FORM_TITLES: Record<string, string> = {
  "create-pr": "Create Pull Request",
  "create-issue": "Create Issue",
  "create-branch": "Create Branch",
  "create-release": "Create Release",
  "create-repo": "Create Repository",
  dispatch: "Dispatch Workflow",
  clone: "Clone Repository",
  download: "Download Repository as ZIP",
  review: "Add Review",
  comment: "Add Comment",
  metadata: "Edit Labels and Assignees",
  reviewers: "Request Review",
  project: "Add to Project",
  milestone: "Set Milestone",
  checkout: "Checkout Pull Request",
  openwith: "Open With",
  owner: "Choose Project Owner",
  issueType: "Set Issue Type",
};
export const buildForm = async (
  action: string,
  row?: Row,
  values: Record<string, string> = {},
): Promise<FormState> => {
  let fields: Field[] = [];
  if (
    ["create-pr", "create-issue", "create-branch", "create-release", "dispatch", "download"].includes(action)
  ) {
    const options = await repoOptions();
    const chosen = values.repository || row?.repo || options[0]?.value || "";
    if (chosen && !options.some((o) => o.value === chosen)) options.unshift({ text: chosen, value: chosen });
    fields.push(
      field("repository", "Repository", { type: "picker", options, value: chosen, required: true }),
    );
    if (chosen) {
      const repo = repoName(chosen);
      const r = object(await api(`repos/${repo}`));
      const branches = (await allPages(`repos/${repo}/branches`)).map((b) => text(b.name));
      const defaultBranch = text(r.default_branch);
      if (action === "create-pr") {
        fields.push(
          picker(
            "head",
            "From",
            branches,
            branches.find((b) => b !== defaultBranch),
          ),
          picker("base", "Into", branches, defaultBranch),
          check("draft", "As draft"),
          check("auto", "Enable auto-merge"),
          field("title", "Title", { required: true }),
          area("body", "Description"),
          picker("method", "Auto-merge method", ["SQUASH", "MERGE", "REBASE"]),
          field("reviewers", "Reviewers", { placeholder: "usernames or org/team, comma-separated" }),
        );
      }
      if (action === "create-issue")
        fields.push(field("title", "Title", { required: true }), area("body", "Description"));
      if (action === "create-pr" || action === "create-issue") {
        fields.push(
          field("assignees", "Assignees", { placeholder: "usernames, comma-separated" }),
          field("labels", "Labels", { placeholder: "label names, comma-separated" }),
          field("projects", "Project numbers", { placeholder: "owner/number, comma-separated" }),
          field("milestone", "Milestone number", { placeholder: "Optional numeric milestone" }),
        );
        if (action === "create-issue")
          fields.push(field("issueType", "Issue type", { placeholder: "Optional issue type name" }));
      }
      if (action === "create-branch") {
        const issues = (await allPages(`repos/${repo}/issues?state=open`)).filter((i) => !i.pull_request);
        fields.push(
          field("issue", "Linked Issue", {
            type: "picker",
            value: row?.kind === "issue" ? text(row.raw.node_id) : "",
            options: [
              { text: "No issue", value: "" },
              ...issues.map((i) => ({ text: `#${text(i.number)} ${text(i.title)}`, value: text(i.node_id) })),
            ],
          }),
          field("name", "Name", { required: true, placeholder: "feature/my-change" }),
          picker("base", "From", branches, defaultBranch),
        );
      }
      if (action === "create-release")
        fields.push(
          field("tag", "Tag", { required: true }),
          field("title", "Title"),
          picker("target", "Target", branches, defaultBranch),
          check("draft", "Draft"),
          check("prerelease", "Pre-release"),
          area("body", "Release notes"),
          check("generate", "Generate release notes"),
        );
      if (action === "dispatch") {
        const workflows = await allPages(`repos/${repo}/actions/workflows`, "workflows");
        fields.push(
          field("workflow", "Workflow", {
            type: "picker",
            value: values.workflow || row?.id || text(workflows[0]?.id),
            options: workflows.map((w) => ({ text: text(w.name), value: text(w.id) })),
          }),
          picker("ref", "Ref", branches, defaultBranch),
          area("inputs", "Inputs JSON"),
        );
        fields[fields.length - 1]!.placeholder = '{"environment":"staging"}';
      }
      if (action === "download")
        fields.push(
          picker("ref", "Branch / tag", branches, defaultBranch),
          field("directory", "Directory in repo", { placeholder: "Optional, e.g. docs/guides" }),
          field("destination", "Save folder", { value: "~/Downloads" }),
        );
    }
  } else
    switch (action) {
      case "create-repo": {
        const me = await viewer();
        const orgs = array(await api("user/orgs?per_page=100"));
        fields = [
          picker("owner", "Owner", [text(me.login), ...orgs.map((o) => text(o.login))]),
          field("name", "Name", { required: true }),
          area("description", "Description"),
          { ...check("private", "Private repository"), value: "1" },
          check("readme", "Initialize README"),
        ];
        break;
      }
      case "clone":
        fields = [
          field("url", "Repository URL", { required: true, value: row?.url ? row.url + ".git" : "" }),
          field("parent", "Clone into", {
            type: "picker",
            required: true,
            value: str("clone_path") || scanRoots()[0] || "",
            options: [...new Set([str("clone_path"), ...scanRoots()].filter(Boolean))].map((value) => ({
              text: value,
              value,
            })),
          }),
          field("name", "Folder name", { placeholder: "Optional; defaults to repository name" }),
          field("application", "Open in", { value: str("default_app", "Visual Studio Code") }),
        ];
        break;
      case "checkout":
        fields = [
          field("parent", "Clone parent folder", {
            required: true,
            value: str("clone_path") || scanRoots()[0] || "",
          }),
          field("application", "Open in", { value: str("default_app", "Visual Studio Code") }),
        ];
        break;
      case "review":
        fields = [
          area("body", "Comment"),
          picker("event", "Review type", ["COMMENT", "APPROVE", "REQUEST_CHANGES"]),
        ];
        break;
      case "comment":
        fields = [area("body", "Comment")];
        break;
      case "metadata":
        fields = [
          field("assignees", "Assignees to add", { placeholder: "usernames, comma-separated" }),
          field("labels", "Labels to add", { placeholder: "names, comma-separated" }),
          field("removeAssignees", "Remove assignees"),
          field("removeLabels", "Remove labels"),
        ];
        break;
      case "reviewers":
        fields = [
          field("reviewers", "Reviewers", {
            required: true,
            placeholder: "usernames or org/team, comma-separated",
          }),
        ];
        break;
      case "project":
        fields = [
          field("owner", "Project owner", { value: text((await viewer()).login), required: true }),
          field("number", "Project number", { required: true }),
        ];
        break;
      case "milestone": {
        const milestones = array(
          await api(`repos/${repoName(row?.repo || "")}/milestones?state=open&per_page=100`),
        );
        fields = [
          field("milestone", "Milestone", {
            type: "picker",
            value: "",
            options: [
              { text: "No milestone", value: "" },
              ...milestones.map((m) => ({ text: text(m.title), value: text(m.number) })),
            ],
          }),
        ];
        break;
      }
      case "issueType":
        fields = [field("issueType", "Issue type", { required: true })];
        break;
      case "openwith":
        fields = [
          field("application", "Application", {
            value: str("default_app", "Visual Studio Code"),
            required: true,
          }),
        ];
        break;
      case "owner":
        fields = [field("owner", "Project owner", { value: text((await viewer()).login), required: true })];
        break;
      default:
        throw new Error("Unknown form.");
    }
  return {
    action,
    title: FORM_TITLES[action] || action,
    row,
    fields,
    values: {
      ...Object.fromEntries(
        fields.map((f) => {
          const candidate = values[f.name] ?? f.value ?? "";
          return [
            f.name,
            f.type === "picker" && !f.options?.some((o) => o.value === candidate)
              ? f.value || f.options?.[0]?.value || ""
              : candidate,
          ];
        }),
      ),
      formPage: values.formPage || "0",
    },
  };
};
export const formValues = (form: FormState, args: string[]): Record<string, string> => {
  const values = { ...form.values };
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    if (key && form.fields.some((f) => f.name === key)) values[key] = (args[i + 1] || "").slice(0, 100_000);
  }
  return values;
};
export const validateForm = (form: FormState): void => {
  for (const f of form.fields)
    if (f.required && !form.values[f.name]?.trim()) throw new Error(`${f.title} is required.`);
};
export const csv = (s = ""): string[] =>
  s
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
