import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "lc-test-"));
process.env.alfred_workflow_cache = join(dir, "cache");
process.env.alfred_workflow_data = join(dir, "data");
const api = await import("../src/api.ts");
const { problemMarkdown, htmlToMarkdown, PAID_NOTICE } = await import("../src/markdown.ts");
const { problemRow, profileRows, ago } = await import("../src/screens.ts");

const problem = {
  id: "1",
  title: "Two Sum",
  slug: "two-sum",
  difficulty: "Easy" as const,
  paid: false,
  likes: 100,
  dislikes: 3,
  content:
    "<p>Return <code>nums[i] + nums[j]</code> for 10<sup>4</sup> items, x<sub>i</sub>.</p><pre><strong>Input:</strong> nums = [2,7]</pre>",
  stats: { totalAccepted: "1M", totalSubmission: "2M", acRate: "50.0%" },
  topics: ["Array"],
  snippets: [],
};

test("descriptions become Markdown: inline code, ^ and _, code blocks without **", () => {
  const md = htmlToMarkdown(problem.content);
  expect(md).toContain("`nums[i] + nums[j]`");
  expect(md).toContain("10^4");
  expect(md).toContain("x_i");
  expect(md).toContain("```\nInput: nums = [2,7]\n```");
});

test("the preview follows Raycast's layout, and premium problems show the notice", () => {
  const md = problemMarkdown(problem, { date: "2026-11-27", stats: true, topics: false, rating: null });
  expect(md.startsWith("# 1. Two Sum\n")).toBe(true);
  expect(md).toContain(
    "**🗓️ Date**: 2026-11-27 | **🧠 Difficulty**: Easy | **👍 Likes**: 100 | **👎 Dislikes**: 3 | **📈 Rating**: Unrated",
  );
  expect(md).toContain("> **Accepted** 1M | **Submissions** 2M | **Accepted Rate** 50.0%");
  expect(md).not.toContain("Topics");
  expect(
    problemMarkdown({ ...problem, paid: true, content: null }, { stats: false, topics: true }),
  ).toContain(PAID_NOTICE);
});

test("rows carry the difficulty tag, lock and rating colours", () => {
  const row = problemRow({ ...problem, acRate: "50.0%" }, 1850);
  expect(row).toMatchObject({
    uid: "two-sum",
    "rowTitle.text": "1. Two Sum",
    "rowNote.text": "50.0%",
    "rowLock.hidden": true,
    "rowLevel.text": "Easy",
    "rowRating.text": "1850",
    "rowRating.colour": "#ffa116",
  });
  expect(problemRow(problem, undefined)["rowRating.text"]).toBe("");
  expect(ago(Date.now() - 3 * 3_600_000)).toBe("3h ago");
});

const respond = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 });

test("search uses LeetCode's panel query for keywords and the list query otherwise", async () => {
  const bodies: string[] = [];
  api.setFetcher(async (_url, init) => {
    bodies.push(String(init?.body));
    return String(init?.body).includes("problemsetPanelQuestionList")
      ? respond({
          panel: {
            questions: [
              {
                difficulty: "MEDIUM",
                questionFrontendId: "2",
                paidOnly: false,
                title: "Add Two Numbers",
                titleSlug: "add-two-numbers",
                acRate: 0.401,
              },
            ],
            hasMore: false,
          },
        })
      : respond({
          list: {
            total: 120,
            data: [
              {
                difficulty: "Easy",
                questionFrontendId: "1",
                isPaidOnly: false,
                title: "Two Sum",
                titleSlug: "two-sum",
                stats: '{"acRate":"49.3%"}',
              },
            ],
          },
        });
  });
  const keyword = await api.searchProblems("add two", "", 0);
  expect(keyword.rows[0]).toMatchObject({ difficulty: "Medium", acRate: "40.1%" });
  const all = await api.searchProblems("", "algorithms", 1);
  expect(all).toMatchObject({ hasMore: true, rows: [{ acRate: "49.3%" }] });
  expect(JSON.parse(bodies[1]!).variables).toMatchObject({ categorySlug: "algorithms", skip: 50, limit: 50 });
});

const page = (paid: boolean[]) =>
  paid.map((p, i) => ({
    difficulty: "Hard",
    questionFrontendId: String(i),
    isPaidOnly: p,
    title: `P${i}`,
    titleSlug: `p${i}`,
    stats: "{}",
  }));

test("random picks re-draw premium problems and refuse an all-premium filter", async () => {
  let premiumTotal = 1;
  api.setFetcher(async (_url, init) => {
    const { variables } = JSON.parse(String(init?.body));
    if (variables.filters.premiumOnly) return respond({ list: { total: premiumTotal, data: [] } });
    return respond({ list: { total: 2, data: variables.limit === 1 ? [] : page([true, false]) } });
  });
  const draws = [0.1, 0.9]; // first lands on the premium problem, second on the free one
  const pick = await api.randomProblem(
    { category: "", difficulty: "HARD", topic: "", excludePremium: true },
    () => draws.shift() ?? 0.9,
  );
  expect(pick.slug).toBe("p1");
  premiumTotal = 2;
  await expect(
    api.randomProblem({ category: "", difficulty: "", topic: "", excludePremium: true }),
  ).rejects.toThrow("premium");
});

test("profile rows have unique ids; ratings parse from zerotrac's file", () => {
  const rows = profileRows({
    username: "example",
    realName: "",
    ranking: 1234,
    reputation: 5,
    company: "",
    school: "",
    country: "",
    solved: { All: 10, Easy: 5, Medium: 4, Hard: 1 },
    totals: { All: 3000, Easy: 900, Medium: 1500, Hard: 600 },
    streak: 2,
    activeDays: 30,
    badges: [],
    links: [{ label: "GitHub", url: "https://github.com/example" }],
    recent: [{ title: "Two Sum", slug: "two-sum", timestamp: Date.now() }],
  });
  const ids = rows.map((r) => r.uid);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toContain("two-sum");
  expect(ids).toContain("link:https://github.com/example");
  expect(
    api.parseRatings("Rating\tID\tTitle\tTitle ZH\tSlug\n1850.4\t1\tTwo Sum\t两数之和\ttwo-sum\nbad"),
  ).toEqual({ "two-sum": 1850 });
});
