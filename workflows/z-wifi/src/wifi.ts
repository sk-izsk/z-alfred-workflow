import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);
export type Network = {
  id: string;
  name: string;
  connected: boolean;
  channel: string;
  security: string;
  signal: string;
  saved: boolean;
  hidden: boolean;
};
export type Snapshot = { device: string; power: boolean; rows: Network[]; note: string };
export const hardware = (text: string): string =>
  text.match(/Hardware Port: (?:Wi-Fi|AirPort)\s+Device: (en\d+)/)?.[1] || "";
const visible = (value: unknown): value is string =>
  typeof value === "string" && !!value && !/^<.*>$|redacted|hidden/i.test(value);
export const parse = (raw: any, preferred: string[], device: string, power: boolean): Snapshot => {
  const rows: Network[] = [];
  let redacted = false;
  for (const iface of raw?.SPAirPortDataType?.[0]?.spairport_airport_interfaces || []) {
    if (iface._name !== device) continue;
    const current = iface.spairport_current_network_information;
    const all = [
      ...(current ? [{ ...current, current: true }] : []),
      ...(iface.spairport_airport_other_local_wireless_networks || []),
    ];
    for (const n of all) {
      if (!visible(n._name)) {
        redacted = true;
        if (n.current && (n.spairport_security_mode || n.spairport_network_channel))
          rows.push({
            id: "__current__",
            name: "Connected network · name hidden by macOS",
            connected: true,
            channel: String(n.spairport_network_channel || ""),
            security: String(n.spairport_security_mode || "Unknown"),
            signal: String(n.spairport_signal_noise || ""),
            saved: false,
            hidden: true,
          });
        continue;
      }
      const id = String(n._name);
      if (rows.some((x) => x.id === id)) continue;
      rows.push({
        id,
        name: id,
        connected: !!n.current,
        channel: String(n.spairport_network_channel || ""),
        security: String(n.spairport_security_mode || "Unknown"),
        signal: String(n.spairport_signal_noise || ""),
        saved: preferred.includes(id),
        hidden: false,
      });
    }
  }
  for (const name of preferred) {
    if (visible(name) && !rows.some((x) => x.id === name))
      rows.push({
        id: name,
        name,
        connected: false,
        channel: "",
        security: "Saved network",
        signal: "",
        saved: true,
        hidden: false,
      });
  }
  return {
    device,
    power,
    rows: rows.toSorted((a, b) => Number(b.connected) - Number(a.connected) || a.name.localeCompare(b.name)),
    note: redacted ? "macOS hides network names; use Wi-Fi Settings or grant required system access." : "",
  };
};
const run = async (cmd: string, args: string[], timeout = 12000): Promise<string> => {
  try {
    return (await execute(cmd, args, { encoding: "utf8", timeout, maxBuffer: 2e6 })).stdout;
  } catch {
    throw new Error(
      "Wi-Fi operation failed or timed out. Open Wi-Fi Settings to check permissions and connectivity.",
    );
  }
};
export const scan = async (): Promise<Snapshot> => {
  const device = hardware(await run("/usr/sbin/networksetup", ["-listallhardwareports"]));
  if (!device) return { device: "", power: false, rows: [], note: "No Wi-Fi interface detected." };
  const [report, preferred, power] = await Promise.all([
    run("/usr/sbin/system_profiler", ["SPAirPortDataType", "-json", "-detailLevel", "mini"], 15000),
    run("/usr/sbin/networksetup", ["-listpreferredwirelessnetworks", device]),
    run("/usr/sbin/networksetup", ["-getairportpower", device]),
  ]);
  return parse(
    JSON.parse(report),
    preferred
      .split("\n")
      .slice(1)
      .map((x) => x.replace(/^\t/, ""))
      .filter(Boolean),
    device,
    /: On\s*$/i.test(power),
  );
};
export const setPower = async (device: string, on: boolean): Promise<void> => {
  if (!/^en\d+$/.test(device)) throw new Error("Invalid Wi-Fi device.");
  const output = await run("/usr/sbin/networksetup", ["-setairportpower", device, on ? "on" : "off"]);
  if (output.trim()) throw new Error(output.trim().slice(0, 300));
};
export const connect = async (device: string, ssid: string): Promise<void> => {
  if (
    !/^en\d+$/.test(device) ||
    !ssid ||
    Buffer.byteLength(ssid, "utf8") > 32 ||
    [...ssid].some((char) => char.charCodeAt(0) < 32)
  )
    throw new Error("Invalid Wi-Fi network.");
  const fresh = await scan();
  if (fresh.device !== device || !fresh.rows.some((x) => x.id === ssid && x.saved))
    throw new Error(
      "Only a saved network can be connected here. Use Wi-Fi Settings for new networks or passwords.",
    );
  const output = await run("/usr/sbin/networksetup", ["-setairportnetwork", device, ssid], 15000);
  if (/error|failed|could not|password|not found/i.test(output))
    throw new Error(
      "Connection requires Wi-Fi Settings or a saved credential. No password is collected by this workflow.",
    );
};
export const disconnect = async (device: string): Promise<void> => {
  if (!/^en\d+$/.test(device)) throw new Error("Invalid Wi-Fi device.");
  await run("/usr/bin/osascript", [
    "-l",
    "JavaScript",
    "-e",
    'ObjC.import("CoreWLAN");function run(argv){var i=$.CWWiFiClient.sharedWiFiClient.interfaceWithName(argv[0]);if(!i)throw new Error("Interface unavailable");i.disassociate;return "ok";}',
    device,
  ]);
};
