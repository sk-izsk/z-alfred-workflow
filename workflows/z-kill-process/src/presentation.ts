import { existsSync } from "node:fs";
import { bytes, filterProcesses, type ProcessInfo } from "./model.ts";
import { selected, type State } from "./state.ts";
import { bool } from "./env.ts";
import { type Action } from "./ui.ts";
export const processRows = (rows: ProcessInfo[]): Action[] =>
  rows.map((p) => ({
    uid: p.id,
    "rowName.text": p.name,
    "rowPath.text": `PID ${p.pid} · ${p.path}`,
    "rowPath.tooltip": p.path,
    "rowCPU.text": `${p.cpu.toFixed(1)}%`,
    "rowCPU.tooltip": "Process CPU can exceed 100% when using multiple cores.",
    "rowMemory.text": bytes(p.memory),
    "rowMemory.tooltip": "Resident memory (RSS); shared pages can be counted in multiple processes.",
    "rowIcon.image.type": p.app && existsSync(p.app) ? "fileicon" : "symbol",
    "rowIcon.image.src": p.app && existsSync(p.app) ? p.app : "terminal",
  }));
export const render = (s: State): Action => {
  const rows = filterProcesses(s.rows, s.query, s.sort, bool("search_paths", true));
  const picked = selected(s);
  const chosen = rows.some((p) => p.id === picked) ? picked : rows[0]?.id || "";
  const cpu = s.metrics.cpu,
    ram = s.metrics.memory;
  return {
    update: {
      relayout: true,
      ids: {
        items: { data: { src: processRows(rows) }, select: chosen, placeholder: "No matching processes." },
        countLabel: { text: `${rows.length} / ${s.rows.length}` },
        cpuValue: { text: cpu === null ? "CPU —" : `CPU ${cpu.toFixed(1)}%` },
        cpuBar: {
          progress: (cpu || 0) / 100,
          tooltip: "System CPU utilization across all cores (recent sample).",
        },
        ramValue: { text: ram === null ? "RAM —" : `RAM ${ram.toFixed(1)}%` },
        ramBar: {
          progress: (ram || 0) / 100,
          tooltip: `${bytes(s.metrics.used)} / ${bytes(s.metrics.total)} · Active + wired + compressed physical memory. File cache is excluded; this differs from macOS memory pressure.`,
        },
        statusLabel: {
          text: `${s.rows.length} running · ${s.sort === "memory" ? "Memory" : "CPU"} descending · ⌘R refresh`,
          colour: "secondaryLabelColor",
        },
      },
    },
    functions: { ids: { items: "filterdata" } },
  };
};
