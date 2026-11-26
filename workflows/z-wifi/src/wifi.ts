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
export type Association = { connected: boolean; name: string; security: string };
export const association = (summary: string): Association => {
  const field = (key: string) => summary.match(new RegExp(`^  ${key} : (.+)$`, "m"))?.[1]?.trim() || "";
  const name = field("SSID");
  return {
    connected: field("LinkStatusActive") === "TRUE" && field("InterfaceType") === "WiFi",
    name: visible(name) ? name : "",
    security: field("Security"),
  };
};
export const parse = (
  raw: any,
  preferred: string[],
  device: string,
  power: boolean,
  link?: Association,
): Snapshot => {
  const rows: Network[] = [];
  let redacted = false;
  for (const iface of raw?.SPAirPortDataType?.[0]?.spairport_airport_interfaces || []) {
    if (iface._name !== device) continue;
    const current = iface.spairport_current_network_information;
    if (!current && power && iface.spairport_status_information === "spairport_status_connected" && !link)
      link = { connected: true, name: "", security: "Unknown" };
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
  if (power && link?.connected) {
    if (link.name) {
      const known = rows.find((row) => row.name === link.name);
      for (const row of rows) row.connected = false;
      const hidden = rows.findIndex((row) => row.hidden);
      if (hidden >= 0) rows.splice(hidden, 1);
      if (known) known.connected = true;
      else
        rows.push({
          id: link.name,
          name: link.name,
          connected: true,
          channel: "",
          security: link.security || "Unknown",
          signal: "",
          saved: preferred.includes(link.name),
          hidden: false,
        });
    } else if (!rows.some((row) => row.connected)) {
      redacted = true;
      rows.push({
        id: "__current__",
        name: "Connected network · name hidden by macOS",
        connected: true,
        channel: "",
        security: link.security || "Unknown",
        signal: "",
        saved: false,
        hidden: true,
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
  const [report, preferred, power, summary] = await Promise.all([
    run("/usr/sbin/system_profiler", ["SPAirPortDataType", "-json", "-detailLevel", "mini"], 15000),
    run("/usr/sbin/networksetup", ["-listpreferredwirelessnetworks", device]),
    run("/usr/sbin/networksetup", ["-getairportpower", device]),
    run("/usr/sbin/ipconfig", ["getsummary", device]).catch(() => ""),
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
    summary ? association(summary) : undefined,
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

/** Keychain authenticates access; the secret stays out of workflow state, JSON actions and clipboard. */
export const showPassword = async (ssid: string): Promise<void> => {
  if (!ssid || Buffer.byteLength(ssid, "utf8") > 32 || [...ssid].some((char) => char.charCodeAt(0) < 32))
    throw new Error("Select a saved network with a visible name.");
  let password: string;
  try {
    password = (
      await execute(
        "/usr/bin/security",
        ["find-generic-password", "-D", "AirPort network password", "-a", ssid, "-w"],
        { encoding: "utf8", timeout: 120000, maxBuffer: 65536 },
      )
    ).stdout.replace(/\r?\n$/, "");
  } catch {
    throw new Error(
      "Password access was cancelled, denied, or this network has no saved Keychain password. You can also view Wi-Fi passwords in Apple's Passwords app.",
    );
  }
  const dialog = execute("/usr/bin/osascript", ["-"], { encoding: "utf8", timeout: 120000 });
  dialog.child.stdin?.end(passwordDialog(password, ssid));
  try {
    await dialog;
  } catch {
    /* Closing the dialog reveals no secret in the action response. */
  }
};

const quote = (value: string) =>
  '"' + value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n") + '"';
export const passwordDialog = (password: string, ssid: string): string =>
  `display dialog ${quote(password)} with title ${quote("Wi-Fi password · " + ssid)} buttons {"Done"} default button "Done" giving up after 60\nreturn ""`;
