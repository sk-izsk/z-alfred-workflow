import { health, packageDetails, searchPackages, type Package } from "./model.ts";
import { type ViewState } from "./state.ts";
import { type Action, fn, merge, status, update } from "./ui.ts";
export const packageRows = (packages: Package[], state: ViewState): Action[] =>
  packages.map((p) => {
    const h = health(p);
    const chosen = state.selected.includes(p.id);
    return {
      uid: p.id,
      "rowTitle.text": p.kind === "cask" ? p.name : p.token,
      "rowDesc.text": p.desc,
      "rowDesc.tooltip": p.desc,
      "rowIcon.image.type": "symbol",
      "rowIcon.image.src":
        state.mode === "upgrades" && !p.pinned ? (chosen ? "checkmark.circle.fill" : "circle") : h.icon,
      "rowIcon.contenttintcolour": h.colour,
      "rowStatus.text": p.pinned ? `${h.label ? h.label + " · " : ""}Pinned` : h.label,
      "rowStatus.colour": h.colour,
      "rowStatus.tooltip": p.reason || h.label,
      "rowPin.opacity": p.pinned ? 1 : 0,
      "rowVersion.text": p.outdated
        ? `${p.installed.join(", ")} → ${p.version}`
        : p.installed.join(", ") || p.version,
      "rowVersion.tooltip": p.version,
      "rowCell.tooltip": [p.desc, p.reason].filter(Boolean).join("\n"),
    };
  });
export const render = (state: ViewState, type = "all", filter = "all", query = ""): Action => {
  let rows: Action[];
  if (state.items)
    rows = state.items
      .filter((i) => `${i.title} ${i.description}`.toLowerCase().includes(query.toLowerCase()))
      .map((i) => ({
        uid: i.id,
        "rowTitle.text": i.title,
        "rowDesc.text": i.description,
        "rowVersion.text": i.value,
        "rowStatus.text": "",
        "rowPin.opacity": 0,
        "rowIcon.image.type": i.path ? "fileicon" : "symbol",
        "rowIcon.image.src": i.path || i.icon,
        "rowIcon.contenttintcolour": i.colour,
      }));
  else {
    const available = state.packages.filter(
      (p) =>
        filter === "all" ||
        (filter === "outdated" && p.outdated) ||
        (filter === "pinned" && p.pinned) ||
        (filter === "attention" && (p.deprecated || p.disabled)),
    );
    rows = packageRows(searchPackages(available, query, type, state.mode === "search" ? 200 : 5000), state);
  }
  return merge(
    update({
      items: {
        data: { src: rows },
        placeholder:
          state.mode === "search"
            ? "No matching packages. Try a different query or refresh."
            : "No matching entries.",
      },
      primaryButton: {
        text:
          state.mode === "upgrades"
            ? `Upgrade Selected (${state.selected.length})`
            : state.mode === "adopt"
              ? "Preview Adoption  ↩"
              : "Show Details  ↩",
      },
    }),
    fn({ items: ["filterdata", "selectfirst"] }),
    status(`${rows.length} ${state.mode === "search" ? "results (up to 200)" : "entries"} · ⌘R refresh`),
  );
};
export const metadata = (p: Package): Action =>
  update({
    details: {
      data: {
        src: packageDetails(p).map(([caption, value]) => ({
          "detailCaption.text": caption,
          "detailValue.text": value,
          "detailValue.tooltip": value,
        })),
      },
    },
  });
