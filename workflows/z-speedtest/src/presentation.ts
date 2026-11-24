import {
  dashboardSvg,
  latencySvg,
  loadedLatencySvg,
  speedGaugeSvg,
  speedSparklineSvg,
  summarySvg,
} from "./charts.ts";
import type { State } from "./model.ts";
import { statusText } from "./model.ts";
import { theme, xml } from "./svg.ts";
import { pingToString, qualities, speedToString } from "./utils.ts";
export const entries = [
  ["interface", "ISP", "globe"],
  ["server", "Server", "externaldrive"],
  ["ping", "Ping", "line.3.horizontal"],
  ["download", "Download", "arrow.down.to.line"],
  ["upload", "Upload", "arrow.up.to.line"],
  ["voice", "Voice Call", "phone"],
  ["video", "Video Call", "video"],
  ["stream", "Streaming", "dot.radiowaves.left.and.right"],
  ["result", "Result Link", "link"],
] as const;
export const section = (state: State, id: string): unknown => {
  if (["voice", "video", "stream"].includes(id) || id === "result") return state.result;
  return state.result[id as keyof typeof state.result] ?? state.result;
};
export const summary = (s: State): string => {
  const r = s.result;
  return `ISP: ${r.isp}; Server: ${r.server.name}; Ping: ${pingToString(r.ping.latency)}; Download: ${speedToString(r.download.bandwidth)}; Upload: ${speedToString(r.upload.bandwidth)}; Result: ${r.result.url}`;
};
export const rows = (s: State) =>
  entries.map(([uid, title, symbol]) => {
    const r = s.result;
    const values: Record<string, string> = {
      interface: r.isp || "?",
      server: r.server.name || "?",
      ping: pingToString(r.ping.latency),
      download: speedToString(r.download.bandwidth),
      upload: speedToString(r.upload.bandwidth),
      result: r.result.url || "?",
    };
    const value = values[uid] ?? (qualities(r.download.bandwidth, r.upload.bandwidth, uid).join(" ") || "?");
    const p = s.progress[uid as keyof typeof s.progress];
    return {
      uid,
      match: `${title} ${value}`,
      "rowTitle.text": title,
      "rowValue.text": value,
      "rowIcon.image": { type: "symbol", src: symbol },
      "rowProgress.hidden": s.phase !== uid,
      "rowProgress.progress": p ?? 0,
    };
  });
const names: Record<string, string> = {
  interface: "Internet Service Provider",
  server: "Server",
  isp: "ISP",
  packetLoss: "Packet Loss",
  bandwidth: "Bandwidth",
  bytes: "Bytes",
  elapsed: "Elapsed",
  latency: "Latency",
  low: "Low Latency",
  high: "High Latency",
  jitter: "Jitter",
  iqm: "IQM",
  internalIp: "Internal IP",
  externalIp: "External IP",
  macAddr: "Mac Address",
  isVpn: "Is VPN",
  name: "Name",
  id: "ID",
  host: "Host",
  port: "Port",
  location: "Location",
  country: "Country",
  ip: "IP",
  url: "URL",
  persisted: "Persisted",
  download: "Download",
  upload: "Upload",
  ping: "Ping",
  result: "Result",
  progress: "Progress",
};
const metadata = (obj: unknown): string => {
  if (!obj || typeof obj !== "object") return "";
  return Object.entries(obj)
    .map(([key, value]) => {
      const title = xml(names[key] ?? key);
      if (value && typeof value === "object") return `<h3>${title}</h3>${metadata(value)}`;
      const text = xml(typeof value === "boolean" ? (value ? "Yes" : "No") : String(value ?? ""));
      const safeLink =
        key === "url" && /^https:\/\/www\.speedtest\.net\/result\/[a-zA-Z0-9/-]+$/.test(String(value));
      return `<div class="metric"><span>${title}</span><strong>${safeLink ? `<a href="${text}">${text}</a>` : text}</strong></div>`;
    })
    .join("");
};
export const page = (
  content: string,
): string => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:"><style>
:root{color-scheme:${theme.isDark ? "dark" : "light"}}*{box-sizing:border-box}body{margin:0;padding:18px;font:14px -apple-system,BlinkMacSystemFont,sans-serif;color:${theme.text};background:transparent}h3{font-size:13px;font-weight:500;color:${theme.muted};margin:22px 0 12px}h3:first-child{margin-top:0}.dashboard{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:24px;height:calc(100vh - 36px)}.meters{display:flex;align-items:center;justify-content:center;min-height:0}.meters>svg{width:100%;height:auto}.sidebar{border-left:1px solid ${theme.track};padding-left:20px;overflow-y:auto}.metric{display:flex;justify-content:space-between;gap:16px;padding:10px;border-radius:8px;font-size:13px}.metric:nth-child(even){background:${theme.isDark ? "#ffffff08" : "#00000004"}}.metric span{color:${theme.muted}}strong{font-weight:400;text-align:right;overflow-wrap:anywhere;min-width:0}a{color:${theme.download}}.tags{display:flex;gap:5px;flex-wrap:wrap}.tag{color:${theme.download};background:#0a7ff524;padding:4px 6px;border-radius:6px;font-weight:600;font-size:13px;display:inline-flex;align-items:center;gap:4px}.error{min-height:450px;display:flex;align-items:center;justify-content:center;flex-direction:column;text-align:center;color:${theme.muted};gap:22px}.error svg{width:70px;height:70px;fill:currentColor}.error p{max-width:650px;font-size:17px;line-height:1.5}.detail-chart{text-align:center;margin:8px 0 28px}.detail-chart svg{max-width:100%;height:auto}.gauge svg{width:230px}.spark svg{width:420px}.detail-meta{margin-top:24px}
</style></head><body>${content}</body></html>`;
export const dashboardHTML = (s: State): string => {
  if (s.phase === "error")
    return page(
      `<div class="error"><svg viewBox="0 0 80 80" aria-label="Connection error"><rect x="6" y="49" width="10" height="25" rx="4"/><rect x="24" y="37" width="10" height="37" rx="4"/><rect x="42" y="23" width="10" height="51" rx="4" opacity=".5"/><rect x="60" y="9" width="10" height="65" rx="4" opacity=".3"/></svg><p>${xml(s.errorMessage ?? "Speedtest failed")}</p></div>`,
    );
  const r = s.result;
  const icons: Record<string, string> = {
    voice:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z"/></svg>',
    video:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="14" height="14" rx="3"/><path d="m16 9 6-3v12l-6-3z"/></svg>',
    stream:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><path d="M8 8a6 6 0 0 0 0 8m8-8a6 6 0 0 1 0 8M4 4a12 12 0 0 0 0 16M20 4a12 12 0 0 1 0 16"/></svg>',
  };
  const activities = [
    ["Voice Call", "voice"],
    ["Video Call", "video"],
    ["Streaming", "stream"],
  ];
  const tags = activities
    .map(
      ([title, id]) =>
        `<h3>${title}</h3><div class="tags">${
          qualities(r.download.bandwidth, r.upload.bandwidth, id!)
            .map((q) => `<span class="tag">${icons[id!]} ${q}</span>`)
            .join("") ||
          `<span>${r.download.bandwidth && r.upload.bandwidth ? "Not enough bandwidth" : "?"}</span>`
        }</div>`,
    )
    .join("");
  return page(
    `<div class="dashboard"><main class="meters">${dashboardSvg(s)}</main><aside class="sidebar"><h3>Status</h3><p>${xml(statusText(s))}</p>${tags}${metadata({ interface: r.interface, server: r.server, ping: r.ping, download: r.download, upload: r.upload, result: r.result })}</aside></div>`,
  );
};
export const detailHTML = (s: State, id: string): string => {
  const r = s.result;
  let charts = "";
  if (id === "ping") charts = latencySvg(r.ping, "Idle latency");
  else if (id === "download" || id === "upload") {
    const color = id === "download" ? theme.download : theme.upload;
    charts = `<div class="gauge">${speedGaugeSvg({ bandwidth: r[id].bandwidth, progress: s.phase === id ? s.progress[id] : undefined, label: names[id]!, color })}</div><div class="spark">${speedSparklineSvg(s.samples[id], color)}${loadedLatencySvg(r[id], `${names[id]} latency (IQM)`, color)}</div>`;
  } else if (["voice", "video", "stream", "result"].includes(id)) charts = summarySvg(r);
  return page(
    `<div class="detail-chart">${charts}</div><div class="detail-meta">${metadata(section(s, id))}</div>`,
  );
};
