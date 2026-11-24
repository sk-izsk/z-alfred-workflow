import { str } from "./env.ts";
export const entries = [
  { title: "Show Installed", target: "installed", alias: "brewi", words: "installed packages list" },
  { title: "Search", target: "search", alias: "brews", words: "search install formula cask" },
  { title: "Show Upgrades", target: "upgrades", alias: "brewu", words: "upgrades outdated update packages" },
  { title: "Adopt Apps", target: "adopt", alias: "brewa", words: "adopt apps applications" },
  { title: "Run Doctor", target: "doctor", alias: "brewd", words: "doctor health diagnose" },
  { title: "Manage Services", target: "services", alias: "brewsvc", words: "services start stop restart" },
  { title: "Manage Taps", target: "taps", alias: "brewt", words: "taps repositories add remove" },
  {
    title: "Show Vulnerabilities",
    target: "vulns",
    alias: "brewv",
    words: "vulnerabilities security cve osv",
  },
  {
    title: "Update Homebrew",
    target: "maintenance",
    alias: "",
    words: "update homebrew metadata",
    arg: "update",
  },
  {
    title: "Clean Up",
    target: "maintenance",
    alias: "",
    words: "clean cleanup cache downloads",
    arg: "cleanup",
  },
  {
    title: "Clear Workflow Cache",
    target: "maintenance",
    alias: "",
    words: "clear workflow cache",
    arg: "clear-cache",
  },
];
export const rootItems = (query: string) => {
  const q = query.trim().toLowerCase();
  const [head = "", ...tail] = query.trim().split(/\s+/);
  let hits = entries.filter((e) =>
    q
      .split(/\s+/)
      .filter(Boolean)
      .every((w) =>
        `${e.title} ${e.words}`
          .toLowerCase()
          .split(/\s+/)
          .some((word) => word.startsWith(w)),
      ),
  );
  const command = tail.length
    ? entries.find((e) => e.words.split(" ").includes(head.toLowerCase()))
    : undefined;
  if (!hits.length && command) hits = [command];
  if (!hits.length && q)
    return [
      {
        title: `Search Homebrew for “${query.trim()}”`,
        subtitle: "Formulae and casks",
        arg: query.trim(),
        icon: { path: "icon.png" },
        variables: { brew_target: "search" },
      },
    ];
  return hits.map((e) => ({
    title: e.title,
    subtitle: e.alias ? `${e.title} · ${str(`kw_${e.target}`, e.alias)}` : e.title,
    arg: e.arg || (command === e ? tail.join(" ") : ""),
    icon: { path: "icon.png" },
    variables: { brew_target: e.target },
  }));
};
