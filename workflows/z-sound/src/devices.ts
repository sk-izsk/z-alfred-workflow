// Sound devices from CoreAudio (through bin/audio.js) and the rules for listing them.
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
/** bin/audio.js sits next to the bundled bin/sound.mjs. */
const HELPER = fileURLToPath(new URL("./audio.js", import.meta.url));

export type Kind = "output" | "input";
export type Device = {
  id: number;
  uid: string;
  name: string;
  transport: string;
  outputs: number;
  inputs: number;
  outputVolume: number | null;
  inputVolume: number | null;
  muted: boolean;
};
export type Snapshot = {
  output: number | null;
  input: number | null;
  alert: number | null;
  devices: Device[];
};

const helper = async (args: string[]): Promise<any> => {
  const { stdout } = await execFileP("/usr/bin/osascript", ["-l", "JavaScript", HELPER, ...args], {
    encoding: "utf8",
    timeout: 5000,
  });
  const value = JSON.parse(stdout);
  if (value?.error) throw new Error(value.error);
  return value;
};
/** Every device with its channels and volume, plus the current output, input and alert device (~200 ms). */
export const readDevices = (): Promise<Snapshot> => helper(["list"]);
/** Makes the device (by UID, which survives reconnects) the default output, input or alert device. */
export const setDefault = (kind: Kind | "alert", uid: string): Promise<{ name: string }> =>
  helper(["set", kind, uid]);

export const hasKind = (d: Device, kind: Kind): boolean => (kind === "input" ? d.inputs : d.outputs) > 0;
export const isCurrent = (s: Snapshot, d: Device, kind: Kind): boolean =>
  (kind === "input" ? s.input : s.output) === d.id;

const TRANSPORT_LABEL: Record<string, string> = {
  "built-in": "Built-in",
  usb: "USB",
  bluetooth: "Bluetooth",
  hdmi: "HDMI",
  displayport: "DisplayPort",
  airplay: "AirPlay",
  virtual: "Virtual",
  aggregate: "Aggregate",
  thunderbolt: "Thunderbolt",
  firewire: "FireWire",
  pci: "PCI",
};
export const transportLabel = (t: string): string => TRANSPORT_LABEL[t] || t.toUpperCase();

/** An SF Symbol for the row: what the device is, guessed from its transport and name. */
export const symbol = (d: Device, kind: Kind): string => {
  const name = d.name.toLowerCase();
  if (/airpods/.test(name)) return "airpods";
  if (/headphone|headset|buds|beats/.test(name)) return "headphones";
  if (d.transport === "airplay") return "airplayaudio";
  if (d.transport === "hdmi" || d.transport === "displayport") return "tv";
  if (d.transport === "virtual" || d.transport === "aggregate") return "waveform";
  if (d.transport === "bluetooth") return kind === "input" ? "mic" : "headphones";
  if (kind === "input") return /webcam|camera/.test(name) ? "web.camera" : "mic";
  return /display|monitor/.test(name) ? "display" : "hifispeaker";
};

const percent = (v: number | null) => (v === null ? "" : `${Math.round(v * 100)}%`);
/** Second line of a row: Current · Alerts · USB · 64% · Muted. */
export const describe = (s: Snapshot, d: Device, kind: Kind): string =>
  [
    isCurrent(s, d, kind) && "Current",
    kind === "output" && s.alert === d.id && "Alerts",
    transportLabel(d.transport),
    percent(kind === "input" ? d.inputVolume : d.outputVolume),
    d.muted && "Muted",
  ]
    .filter(Boolean)
    .join(" · ");

/** Every word of the query must appear in the name or the transport. */
export const matches = (d: Device, query: string): boolean => {
  const text = `${d.name} ${transportLabel(d.transport)}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
};

/** Device names hidden in Configuration, one per line, matched without case. */
export const hiddenNames = (setting: string): Set<string> =>
  new Set(
    setting
      .split("\n")
      .map((line) => line.trim().toLowerCase())
      .filter(Boolean),
  );

/** The devices for one direction: the current one first, then by name. A hidden device still shows while current. */
export const devicesFor = (s: Snapshot, kind: Kind, query: string, hidden: Set<string>): Device[] =>
  s.devices
    .filter(
      (d) =>
        hasKind(d, kind) && matches(d, query) && (isCurrent(s, d, kind) || !hidden.has(d.name.toLowerCase())),
    )
    .toSorted(
      (a, b) => Number(isCurrent(s, b, kind)) - Number(isCurrent(s, a, kind)) || a.name.localeCompare(b.name),
    );
