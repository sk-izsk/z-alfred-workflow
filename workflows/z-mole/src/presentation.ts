import { cleanOutput, type Item } from "./mole.ts";
export const size = (bytes: unknown): string => {
  let n = Number(bytes);
  if (!Number.isFinite(n)) return "Unavailable";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1024 && i < 4) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
};
const percent = (n: unknown): string =>
  Number.isFinite(Number(n)) ? `${Number(n).toFixed(1)}%` : "Unavailable";
const temperature = (n: unknown): string => (Number(n) > 0 ? `${Number(n).toFixed(1)}°C` : "Unavailable");
export const statusItems = (text: string): Item[] => {
  const d = JSON.parse(text);
  if (!d || typeof d.hardware !== "object" || typeof d.health_score !== "number")
    throw new Error("Unsupported Mole status response.");
  const cpu = d.cpu || {},
    memory = d.memory || {},
    disks = Array.isArray(d.disks) ? d.disks : [],
    batteries = Array.isArray(d.batteries) ? d.batteries : [],
    thermal = d.thermal || {};
  const overview: [string, string][] = [
    ["Health", `${d.health_score}/100 · ${d.health_score_msg || ""}`],
    ["Model", d.hardware.model || "Unavailable"],
    ["OS", d.hardware.os_version || "Unavailable"],
    ["Uptime", d.uptime || "Unavailable"],
    ["CPU", percent(cpu.usage)],
    [
      "Load Average",
      [cpu.load1, cpu.load5, cpu.load15]
        .map((x) => (Number.isFinite(Number(x)) ? Number(x).toFixed(2) : "—"))
        .join(" / "),
    ],
    ["Temperature", temperature(thermal.cpu_temp)],
    ["Memory", `${percent(memory.used_percent)} · ${size(memory.used)} / ${size(memory.total)}`],
    ["Swap", `${size(memory.swap_used)} / ${size(memory.swap_total)}`],
    ...disks.map(
      (v: any) =>
        [`Disk (${v.mount})`, `${percent(v.used_percent)} · ${size(v.used)} / ${size(v.total)}`] as [
          string,
          string,
        ],
    ),
    [
      "Battery",
      batteries.length
        ? batteries.map((v: any) => `${v.percent ?? v.percentage ?? "—"}%`).join(" · ")
        : "Not present",
    ],
    ["Network", Array.isArray(d.network) ? `${d.network.length} interfaces` : "Unavailable"],
  ];
  const items: Item[] = [
    {
      id: "health_score",
      name: "Health Score",
      description: "",
      group: "Overview",
      icon: "heart",
      badge: `${d.health_score}/100`,
      tone: d.health_score >= 80 ? "green" : d.health_score >= 60 ? "yellow" : "red",
      details: overview,
    },
    {
      id: "cpu",
      name: "Processor",
      description: d.hardware.cpu_model || "",
      group: "CPU",
      icon: "cpu",
      badge: percent(cpu.usage),
      tone: usageTone(cpu.usage),
      details: [
        ["CPU", d.hardware.cpu_model || "Unavailable"],
        ["Usage", percent(cpu.usage)],
        ["Cores", String(cpu.core_count ?? "Unavailable")],
        ["Load Average", [cpu.load1, cpu.load5, cpu.load15].join(" / ")],
        ["Temperature", temperature(thermal.cpu_temp)],
      ],
    },
    {
      id: "memory",
      name: "RAM",
      description: `${size(memory.used)} / ${size(memory.total)}`,
      group: "Memory",
      icon: "memory",
      badge: percent(memory.used_percent),
      tone: usageTone(memory.used_percent),
      details: [
        ["Usage", percent(memory.used_percent)],
        ["Used", size(memory.used)],
        ["Total", size(memory.total)],
        ["Available", size(memory.available)],
        ["Swap", `${size(memory.swap_used)} / ${size(memory.swap_total)}`],
        ["Pressure", String(memory.pressure || "Unavailable")],
      ],
    },
    ...disks.map((v: any, i: number) => ({
      id: `disk:${i}`,
      name: String(v.mount || "Disk"),
      description: `${size(v.used)} / ${size(v.total)}`,
      group: "Disk",
      icon: "disk",
      badge: percent(v.used_percent),
      tone: usageTone(v.used_percent),
      details: [
        ["Mount", String(v.mount || "Unavailable")],
        ["Usage", percent(v.used_percent)],
        ["Used", size(v.used)],
        ["Total", size(v.total)],
        ["Filesystem", String(v.fstype || "Unavailable")],
        ["SMART", String(v.smart_status || "Unavailable")],
        ["External", v.external ? "Yes" : "No"],
      ] as [string, string][],
    })),
    {
      id: "batteries",
      name: "Battery",
      description: batteries.length ? "Power" : "No battery",
      group: "Power",
      icon: "battery",
      badge: batteries.length ? `${batteries[0].percent ?? batteries[0].percentage ?? "—"}%` : "—",
      details: [["Battery", batteries.length ? JSON.stringify(batteries) : "Unavailable"]],
    },
    {
      id: "network",
      name: "Network",
      description: "Interfaces",
      group: "Network",
      icon: "network",
      details: [["Interfaces", JSON.stringify(d.network || [])]],
    },
  ];
  return items;
};
export const usageTone = (n: unknown): string =>
  Number(n) >= 85 ? "red" : Number(n) >= 60 ? "yellow" : "green";
export const previewItems = (text: string, mode: "clean" | "optimize"): Item[] => {
  const lines = cleanOutput(text);
  const cleanSummary = lines.map((x) => x.match(/^Potential space:\s*(.+?)\s*·\s*(\d+) items/)).find(Boolean);
  const optSummary = lines.map((x) => x.match(/^Would apply (\d+) optimizations/)).find(Boolean);
  if (mode === "clean" ? !cleanSummary : !optSummary)
    throw new Error("Unsupported Mole preview format. Refresh before running any system change.");
  const out: Item[] = [
    {
      id: "summary",
      name: mode === "clean" ? "Total Recoverable Space" : "Available Optimizations",
      description: mode === "clean" ? `${cleanSummary?.[2] || "Unknown"} items` : "",
      group: "Summary",
      icon: mode === "clean" ? "trash" : "gauge",
      badge:
        mode === "clean"
          ? cleanSummary?.[1] || "Unknown"
          : optSummary
            ? `${optSummary[1]} optimizations`
            : "Unknown",
      tone: mode === "clean" ? "red" : "blue",
      details: [["Mode", "Dry run — no changes made"]],
    },
  ];
  const firstGroup = lines.findIndex((line) => line.startsWith("➤"));
  for (const notice of [
    ...lines.slice(0, firstGroup < 0 ? 0 : firstGroup).filter((line) => line.startsWith("◎")),
    ...lines.filter((line) => line.startsWith("Skipped in this preview")),
  ])
    out.push({
      id: `notice:${out.length}`,
      name: notice.replace(/^◎\s*/, ""),
      description: "",
      group: "Preview Notes",
      icon: "warning",
      badge: "Partial",
      tone: "yellow",
      details: [["Notice", notice]],
    });
  let group = "";
  for (const line of lines) {
    if (line.startsWith("➤")) {
      group = line.slice(1).trim();
      continue;
    }
    if (!group || !/^([○◎✓-])\s+/.test(line)) continue;
    const marker = line[0],
      message = line.replace(/^([○◎✓-])\s+/, "");
    if (message === "Nothing to clean") continue;
    const match = message.match(/^(.*?)\s*(?:·|,)\s*(.*?)(\d+(?:\.\d+)?\s*(?:B|KB|MB|GB|TB))(?:\s+dry|,|$)/i);
    const name = (match?.[1] || message.replace(/\s*·\s*(?:would clean|skipped.*)$/i, "")).trim();
    const badge =
      match?.[3]?.replace(/\s+/g, "") || (/skipped|unavailable|not readable/i.test(message) ? "Skipped" : "");
    const unavailable = marker === "◎" || /skipped|unavailable|not readable/i.test(message);
    out.push({
      id: `preview:${out.length}`,
      name,
      description: "",
      group,
      icon: unavailable ? "warning" : mode === "optimize" ? "check" : "file",
      badge,
      tone: unavailable ? "yellow" : "neutral",
      details: [
        ["Preview", message],
        ["State", unavailable ? "Skipped/unavailable" : "Would apply — not executed"],
      ],
    });
  }
  return out;
};
