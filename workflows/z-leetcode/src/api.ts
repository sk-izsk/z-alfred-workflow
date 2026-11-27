// LeetCode's public GraphQL API (no sign-in) and zerotrac's community ratings. Queries and the
// search/random strategies follow the Raycast LeetCode extension (MIT, see THIRD_PARTY_NOTICES.md).
import { join } from "node:path";
import { cacheDir, readJson, writeJson } from "./env.ts";

export const ENDPOINT = "https://leetcode.com/graphql";
const RATINGS_URL = "https://raw.githubusercontent.com/zerotrac/leetcode_problem_rating/main/ratings.txt";
export const PAGE_SIZE = 50;

export type Difficulty = "Easy" | "Medium" | "Hard";
export type Snippet = { lang: string; langSlug: string; code: string };
export type ProblemRow = {
  id: string;
  title: string;
  slug: string;
  difficulty: Difficulty;
  paid: boolean;
  acRate?: string;
};
export type Problem = ProblemRow & {
  likes: number;
  dislikes: number;
  content: string | null;
  stats: { totalAccepted: string; totalSubmission: string; acRate: string } | undefined;
  topics: string[];
  snippets: Snippet[];
};
export type Profile = {
  username: string;
  realName: string;
  ranking: number | null;
  reputation: number;
  company: string;
  school: string;
  country: string;
  solved: Record<"All" | Difficulty, number>;
  totals: Record<"All" | Difficulty, number>;
  streak: number;
  activeDays: number;
  contest?: {
    rating: number;
    globalRanking: number | null;
    topPercentage: number | null;
    attended: number;
    badge?: string;
  };
  badges: string[];
  links: { label: string; url: string }[];
  recent: { title: string; slug: string; timestamp: number }[];
};

export const CATEGORIES: [string, string][] = [
  ["", "All"],
  ["algorithms", "Algorithms"],
  ["database", "Database"],
  ["shell", "Shell"],
  ["concurrency", "Concurrency"],
  ["javascript", "JavaScript"],
  ["pandas", "pandas"],
];

/** Common topic-tag slugs; LeetCode's filters take slugs, not names. */
export const TOPICS: [string, string][] = [
  ["array", "Array"],
  ["string", "String"],
  ["hash-table", "Hash Table"],
  ["dynamic-programming", "Dynamic Programming"],
  ["math", "Math"],
  ["sorting", "Sorting"],
  ["greedy", "Greedy"],
  ["depth-first-search", "Depth-First Search"],
  ["breadth-first-search", "Breadth-First Search"],
  ["binary-search", "Binary Search"],
  ["tree", "Tree"],
  ["binary-tree", "Binary Tree"],
  ["two-pointers", "Two Pointers"],
  ["bit-manipulation", "Bit Manipulation"],
  ["stack", "Stack"],
  ["heap-priority-queue", "Heap (Priority Queue)"],
  ["graph", "Graph"],
  ["backtracking", "Backtracking"],
  ["sliding-window", "Sliding Window"],
  ["linked-list", "Linked List"],
  ["matrix", "Matrix"],
  ["prefix-sum", "Prefix Sum"],
  ["trie", "Trie"],
  ["union-find", "Union Find"],
];

const PROBLEM_FIELDS = `difficulty questionFrontendId title titleSlug likes dislikes content isPaidOnly stats
  topicTags { name } codeSnippets { lang langSlug code }`;
const LIST_QUERY = `query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
  list: questionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, filters: $filters) {
    total: totalNum
    data { difficulty questionFrontendId isPaidOnly title titleSlug stats }
  }
}`;
// LeetCode's own search: pages through keyword matches in a stable relevance order.
const PANEL_QUERY = `query problemsetPanelQuestionList($categorySlug: String, $limit: Int, $skip: Int, $searchKeyword: String, $filters: QuestionFilterInput) {
  panel: problemsetPanelQuestionList(categorySlug: $categorySlug, limit: $limit, skip: $skip, searchKeyword: $searchKeyword, filters: $filters) {
    questions { difficulty questionFrontendId paidOnly title titleSlug acRate }
    hasMore
  }
}`;
const PROBLEM_QUERY = `query problem($titleSlug: String!) { problem: question(titleSlug: $titleSlug) { ${PROBLEM_FIELDS} } }`;
const DAILY_QUERY = `query dailyChallenge { daily: activeDailyCodingChallengeQuestion { date link problem: question { ${PROBLEM_FIELDS} } } }`;
const PROFILE_QUERY = `query userProfile($username: String!) {
  matchedUser(username: $username) {
    username githubUrl twitterUrl linkedinUrl
    profile { realName countryName company school ranking reputation }
    submitStats { acSubmissionNum { difficulty count } }
    badges { displayName }
    userCalendar { streak totalActiveDays }
  }
  allQuestionsCount { difficulty count }
  userContestRanking(username: $username) { attendedContestsCount rating globalRanking topPercentage badge { name } }
  recentAcSubmissionList(username: $username, limit: 15) { title titleSlug timestamp }
}`;

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;
let fetcher: Fetch = (input, init) => fetch(input, init);
/** Tests replace the network. */
export const setFetcher = (f: Fetch): void => {
  fetcher = f;
};

const graphql = async <T>(query: string, variables: Record<string, unknown> = {}): Promise<T> => {
  const response = await fetcher(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Referer: "https://leetcode.com" },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`LeetCode responded with HTTP ${response.status}. Try again with ⌘R.`);
  const body = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (!body.data) throw new Error(body.errors?.[0]?.message ?? "LeetCode returned no data.");
  return body.data;
};

const PANEL_DIFFICULTY: Record<string, Difficulty> = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" };
const acRateOf = (stats: string): string | undefined => {
  try {
    return (JSON.parse(stats) as { acRate?: string }).acRate;
  } catch {
    // malformed stats: show no rate
    return undefined;
  }
};
type ListItem = {
  difficulty: Difficulty;
  questionFrontendId: string;
  isPaidOnly: boolean;
  title: string;
  titleSlug: string;
  stats: string;
};
const fromList = (q: ListItem): ProblemRow => ({
  id: q.questionFrontendId,
  title: q.title,
  slug: q.titleSlug,
  difficulty: q.difficulty,
  paid: q.isPaidOnly,
  acRate: acRateOf(q.stats),
});

/** One page of problems: keyword search in relevance order, or everything in problem order. */
export const searchProblems = async (
  keyword: string,
  category: string,
  page: number,
): Promise<{ rows: ProblemRow[]; hasMore: boolean }> => {
  const skip = page * PAGE_SIZE;
  if (keyword.trim()) {
    const { panel } = await graphql<{
      panel: {
        questions: {
          difficulty: string;
          questionFrontendId: string;
          paidOnly: boolean;
          title: string;
          titleSlug: string;
          acRate: number | null;
        }[];
        hasMore: boolean;
      } | null;
    }>(PANEL_QUERY, {
      categorySlug: category,
      skip,
      limit: PAGE_SIZE,
      searchKeyword: keyword.trim(),
      filters: { filterCombineType: "ALL" },
    });
    if (!panel) throw new Error("LeetCode returned no problem list.");
    return {
      rows: panel.questions.map((q) => ({
        id: q.questionFrontendId,
        title: q.title,
        slug: q.titleSlug,
        difficulty: PANEL_DIFFICULTY[q.difficulty] ?? "Medium",
        paid: q.paidOnly,
        acRate: q.acRate == null ? undefined : `${(q.acRate * 100).toFixed(1)}%`,
      })),
      hasMore: panel.hasMore,
    };
  }
  const { list } = await graphql<{ list: { total: number; data: ListItem[] } | null }>(LIST_QUERY, {
    categorySlug: category,
    skip,
    limit: PAGE_SIZE,
    filters: {},
  });
  // LeetCode answers rejected arguments with HTTP 200 and a null list.
  if (!list) throw new Error("LeetCode returned no problem list.");
  return { rows: list.data.map(fromList), hasMore: skip + PAGE_SIZE < list.total };
};

type RawProblem = ListItem & {
  likes: number;
  dislikes: number;
  content: string | null;
  topicTags: { name: string }[] | null;
  codeSnippets: Snippet[] | null;
};
const toProblem = (q: RawProblem): Problem => {
  let stats: Problem["stats"];
  try {
    stats = JSON.parse(q.stats);
  } catch {
    // no stats for this problem
    stats = undefined;
  }
  return {
    ...fromList(q),
    likes: q.likes,
    dislikes: q.dislikes,
    content: q.content,
    stats,
    topics: (q.topicTags ?? []).map((t) => t.name),
    snippets: q.codeSnippets ?? [],
  };
};

export const getProblem = async (slug: string): Promise<Problem> => {
  const { problem } = await graphql<{ problem: RawProblem | null }>(PROBLEM_QUERY, { titleSlug: slug });
  if (!problem) throw new Error("Problem not found.");
  return toProblem(problem);
};

export const getDaily = async (): Promise<{ date: string; problem: Problem }> => {
  const { daily } = await graphql<{ daily: { date: string; problem: RawProblem } }>(DAILY_QUERY);
  return { date: daily.date, problem: toProblem(daily.problem) };
};

export type RandomFilters = { category: string; difficulty: string; topic: string; excludePremium: boolean };
const filterInput = (f: RandomFilters) => ({
  ...(f.difficulty && { difficulty: f.difficulty }),
  ...(f.topic && { tags: [f.topic] }),
});
const listPage = async (f: RandomFilters, skip: number, limit: number, extra: object = {}) => {
  const { list } = await graphql<{ list: { total: number; data: ListItem[] } | null }>(LIST_QUERY, {
    categorySlug: f.category,
    skip,
    limit,
    filters: { ...filterInput(f), ...extra },
  });
  if (!list) throw new Error("LeetCode returned no problem list.");
  return list;
};

/**
 * A uniformly random problem matching the filters. LeetCode serves fixed pages (skip is rounded
 * down to a multiple of limit), so fetch the page that holds the pick. Premium picks are re-drawn
 * when excluded; `premiumOnly: false` is ignored by the API, so premium is counted separately.
 */
export const randomProblem = async (f: RandomFilters, random = Math.random): Promise<ProblemRow> => {
  const total = (await listPage(f, 0, 1)).total;
  if (!total) throw new Error("No problems match these filters. Try loosening them.");
  if (f.excludePremium && total - (await listPage(f, 0, 1, { premiumOnly: true })).total <= 0)
    throw new Error(
      "Every problem matching these filters is premium. Include premium or loosen the filters.",
    );
  for (let attempt = 0; attempt < 25; attempt++) {
    const target = Math.floor(random() * total),
      skip = target - (target % PAGE_SIZE);
    const pick = (await listPage(f, skip, PAGE_SIZE)).data[target - skip];
    if (pick && !(f.excludePremium && pick.isPaidOnly)) return fromList(pick);
  }
  throw new Error("Couldn't find a free problem after 25 draws. Try again.");
};

export const getProfile = async (username: string): Promise<Profile> => {
  type Count = { difficulty: "All" | Difficulty; count: number };
  const data = await graphql<{
    matchedUser: {
      username: string;
      githubUrl: string | null;
      twitterUrl: string | null;
      linkedinUrl: string | null;
      profile: {
        realName: string;
        countryName: string | null;
        company: string | null;
        school: string | null;
        ranking: number | null;
        reputation: number | null;
      };
      submitStats: { acSubmissionNum: Count[] };
      badges: { displayName: string }[];
      userCalendar: { streak: number; totalActiveDays: number } | null;
    } | null;
    allQuestionsCount: Count[];
    userContestRanking: {
      attendedContestsCount: number;
      rating: number;
      globalRanking: number | null;
      topPercentage: number | null;
      badge: { name: string } | null;
    } | null;
    recentAcSubmissionList: { title: string; titleSlug: string; timestamp: string }[] | null;
  }>(PROFILE_QUERY, { username });
  const user = data.matchedUser;
  if (!user) throw new Error(`No LeetCode user named “${username}”.`);
  const counts = (list: Count[]) =>
    Object.fromEntries(
      ["All", "Easy", "Medium", "Hard"].map((d) => [d, list.find((c) => c.difficulty === d)?.count ?? 0]),
    ) as Profile["solved"];
  const contest = data.userContestRanking;
  return {
    username: user.username,
    realName: user.profile.realName ?? "",
    ranking: user.profile.ranking,
    reputation: user.profile.reputation ?? 0,
    company: user.profile.company ?? "",
    school: user.profile.school ?? "",
    country: user.profile.countryName ?? "",
    solved: counts(user.submitStats.acSubmissionNum),
    totals: counts(data.allQuestionsCount),
    streak: user.userCalendar?.streak ?? 0,
    activeDays: user.userCalendar?.totalActiveDays ?? 0,
    contest: contest?.attendedContestsCount
      ? {
          rating: Math.round(contest.rating),
          globalRanking: contest.globalRanking,
          topPercentage: contest.topPercentage,
          attended: contest.attendedContestsCount,
          badge: contest.badge?.name,
        }
      : undefined,
    badges: user.badges.map((b) => b.displayName),
    links: [
      ["GitHub", user.githubUrl],
      ["Twitter", user.twitterUrl],
      ["LinkedIn", user.linkedinUrl],
    ].flatMap(([label, url]) => (url ? [{ label: label!, url }] : [])),
    recent: (data.recentAcSubmissionList ?? []).map((s) => ({
      title: s.title,
      slug: s.titleSlug,
      timestamp: Number(s.timestamp) * 1000,
    })),
  };
};

/** zerotrac's ratings.txt (tab-separated: Rating, ID, Title, Title ZH, Slug, …) → slug → rating. */
export const parseRatings = (text: string): Record<string, number> => {
  const ratings: Record<string, number> = {};
  for (const line of text.split("\n").slice(1)) {
    const cols = line.split("\t");
    const rating = Math.round(Number(cols[0]));
    if (cols[4] && Number.isFinite(rating)) ratings[cols[4]] = rating;
  }
  return ratings;
};

/** Community ratings, cached for a day; the stale copy stays when a refresh fails. */
export const ratings = async (): Promise<Record<string, number> | undefined> => {
  const path = join(cacheDir(), "ratings.json");
  const cached = readJson<{ at: number; data: Record<string, number> } | null>(path, null);
  if (cached && Date.now() - cached.at < 86_400_000) return cached.data;
  try {
    const response = await fetcher(RATINGS_URL, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(String(response.status));
    const data = parseRatings(await response.text());
    writeJson(path, { at: Date.now(), data });
    return data;
  } catch {
    // offline or GitHub unavailable: keep the last ratings, if any
    return cached?.data;
  }
};
