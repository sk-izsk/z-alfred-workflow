import type { SpeedtestResult } from "./speedtest.types.ts";
import type { TestPhase } from "./charts.ts";

export type State = {
  phase: TestPhase;
  result: SpeedtestResult;
  progress: { ping?: number; download?: number; upload?: number };
  samples: { download: number[]; upload: number[] };
  errorMessage?: string;
};
export const emptyState = (): State => ({
  phase: "starting",
  progress: {},
  samples: { download: [], upload: [] },
  result: {
    isp: "",
    packetLoss: 0,
    download: { bandwidth: 0, bytes: 0, elapsed: 0, latency: { iqm: 0, low: 0, high: 0, jitter: 0 } },
    upload: { bandwidth: 0, bytes: 0, elapsed: 0, latency: { iqm: 0, low: 0, high: 0, jitter: 0 } },
    ping: { low: 0, high: 0, jitter: 0, latency: 0, packetLoss: 0 },
    interface: { isp: "", internalIp: "", name: "", macAddr: "", isVpn: false, externalIp: "" },
    server: { id: 0, host: "", port: 0, name: "", location: "", country: "", ip: "" },
    result: { id: "", url: "", persisted: false },
  },
});
const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const cleanLike = (value: unknown, defaults: Record<string, unknown>): Record<string, unknown> => {
  if (!record(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([key, v]) => {
      const base = defaults[key];
      return (
        (typeof base === "number" && typeof v === "number" && Number.isFinite(v) && v >= 0) ||
        (typeof base === "string" && typeof v === "string" && v.length <= 4096) ||
        (typeof base === "boolean" && typeof v === "boolean")
      );
    }),
  );
};
/** CLI progress objects omit fields; merge only validated fields into the last snapshot. */
export const applyEvent = (state: State, event: unknown): void => {
  if (!record(event) || typeof event.type !== "string") throw new Error("Could not read data from Speedtest");
  const type = event.type;
  if (!["testStart", "ping", "download", "upload", "result", "log"].includes(type)) return;
  if (type === "log") {
    if (event.level === "error" && typeof event.message === "string") throw new Error(event.message);
    return;
  }
  if (type === "result") {
    for (const key of ["ping", "download", "upload", "server", "interface", "result"] as const) {
      if (!record(event[key])) throw new Error(`Incomplete Speedtest result: ${key}`);
    }
    for (const key of ["download", "upload"] as const) {
      const speed = event[key] as Record<string, unknown>;
      if (typeof speed.bandwidth !== "number" || !Number.isFinite(speed.bandwidth) || speed.bandwidth < 0)
        throw new Error("Invalid Speedtest bandwidth");
    }
  }
  for (const key of ["ping", "download", "upload", "interface", "server", "result"] as const) {
    const incoming = event[key];
    if (!record(incoming)) continue;
    Object.assign(state.result[key], cleanLike(incoming, state.result[key]));
    if ((key === "download" || key === "upload") && record(incoming.latency))
      Object.assign(state.result[key].latency, cleanLike(incoming.latency, state.result[key].latency));
  }
  if (typeof event.isp === "string") {
    state.result.isp = event.isp.slice(0, 4096);
    state.result.interface.isp = state.result.isp;
  }
  if (typeof event.packetLoss === "number" && Number.isFinite(event.packetLoss) && event.packetLoss >= 0) {
    state.result.packetLoss = event.packetLoss;
    state.result.ping.packetLoss = event.packetLoss;
  }
  if (type === "ping" || type === "download" || type === "upload") {
    state.phase = type;
    const incoming = event[type];
    if (record(incoming)) {
      if (typeof incoming.progress === "number" && Number.isFinite(incoming.progress))
        state.progress[type] = Math.max(0, Math.min(1, incoming.progress));
      if (
        type !== "ping" &&
        typeof incoming.bandwidth === "number" &&
        Number.isFinite(incoming.bandwidth) &&
        incoming.bandwidth >= 0
      ) {
        state.samples[type].push(incoming.bandwidth);
        if (state.samples[type].length > 2000) state.samples[type].shift();
      }
    }
  }
  if (type === "result") {
    state.phase = "done";
    state.progress = {};
    const url = state.result.result.url;
    if (!/^https:\/\/www\.speedtest\.net\/result\/[a-zA-Z0-9/-]+$/.test(url)) state.result.result.url = "";
  }
};
export const describeFailure = (stderr: string, code: number | null): string => {
  if (/NoNetworkConnection|Network is unreachable|Could not resolve/i.test(stderr))
    return "The Internet connection appears to be offline.";
  if (/Too many requests|Limit reached/i.test(stderr))
    return "Speedtest rate limit reached. Wait a few minutes before running it again.";
  const line = stderr
    .split(/\r?\n/)
    .map((s) => s.replace(/^\[[^\]]*\]\s*\[error\]\s*/, "").trim())
    .find(Boolean);
  return line
    ? `Speedtest failed: ${line.slice(0, 1200)}`
    : `Speedtest exited with code ${code ?? "unknown"} without a result. Please try again.`;
};
export const lineReader = (consume: (event: unknown) => void) => {
  let buffer = "";
  const line = (text: string) => {
    if (text.trim()) consume(JSON.parse(text));
  };
  return {
    push: (chunk: string) => {
      buffer += chunk;
      if (buffer.length > 1_000_000) throw new Error("Speedtest output is too large");
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      lines.forEach(line);
    },
    end: () => {
      line(buffer);
      buffer = "";
    },
  };
};
export const statusText = (state: State): string => {
  const p = state.phase;
  if (p === "error") return state.errorMessage ?? "Speedtest failed";
  if (p === "done") return "Finished";
  if (p === "starting") return "Starting…";
  if (p === "ping") return "Measuring latency…";
  return `${p === "download" ? "Downloading" : "Uploading"} ${Math.round((state.progress[p] ?? 0) * 100)}%`;
};
