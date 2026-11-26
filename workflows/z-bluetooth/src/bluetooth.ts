import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { str } from "./env.ts";
const execute = promisify(execFile);
export type Device = {
  id: string;
  name: string;
  type: string;
  connected: boolean;
  battery: string;
  raw: Record<string, unknown>;
};
export const validAddress = (address: string): boolean =>
  /^(?:[a-f0-9]{2}[:-]){5}[a-f0-9]{2}$/i.test(address);
export const parse = (raw: any): Device[] => {
  const devices: Device[] = [];
  for (const controller of raw?.SPBluetoothDataType || [])
    for (const [group, connected] of [
      ["device_connected", true],
      ["device_not_connected", false],
    ] as const) {
      for (const wrapper of controller[group] || [])
        for (const [name, value] of Object.entries(wrapper)) {
          const d = value as Record<string, unknown>,
            id = String(d.device_address || "")
              .toUpperCase()
              .replaceAll("-", ":");
          if (!validAddress(id)) continue;
          const battery = Object.entries(d)
            .filter(([key]) => /battery/i.test(key))
            .flatMap(([key, val]) => {
              const n = Number.parseInt(String(val));
              return n >= 0 && n <= 100
                ? [`${key.replace(/^device_batteryLevel/, "") || "Battery"} ${n}%`]
                : [];
            })
            .join(" · ");
          devices.push({
            id,
            name,
            type: String(d.device_minorType || d.device_majorType || "Device"),
            connected,
            battery,
            raw: d,
          });
        }
    }
  return devices.toSorted(
    (a, b) => Number(b.connected) - Number(a.connected) || a.name.localeCompare(b.name),
  );
};
export const scan = async (): Promise<Device[]> => {
  const { stdout } = await execute(
    "/usr/sbin/system_profiler",
    ["SPBluetoothDataType", "-json", "-detailLevel", "mini"],
    { encoding: "utf8", timeout: 12000, maxBuffer: 2e6 },
  );
  return parse(JSON.parse(stdout));
};
export const blueutil = (): string =>
  [str("blueutil_path"), "/opt/homebrew/bin/blueutil", "/usr/local/bin/blueutil"].find(
    (p) => p.startsWith("/") && existsSync(p),
  ) || "";
export const connect = async (address: string, on: boolean): Promise<void> => {
  if (!validAddress(address)) throw new Error("Invalid Bluetooth address.");
  const devices = await scan(),
    device = devices.find((d) => d.id === address);
  if (!device) throw new Error("Paired device no longer exists. Refresh.");
  if (device.connected === on) return;
  const bin = blueutil();
  if (bin) {
    await execute(bin, [on ? "--connect" : "--disconnect", address], { timeout: 15000, maxBuffer: 65536 });
    return;
  }
  const script = `use framework "IOBluetooth"
use scripting additions
on run argv
 set targetAddress to item 1 of argv
 repeat with d in (current application's IOBluetoothDevice's pairedDevices() as list)
  if ((d's addressString as string) is targetAddress) then
   if item 2 of argv is "connect" then
    return d's openConnection() as integer
   else
    return d's closeConnection() as integer
   end if
  end if
 end repeat
 return -1
end run`;
  try {
    const { stdout } = await execute(
      "/usr/bin/osascript",
      ["-e", script, address.replaceAll(":", "-"), on ? "connect" : "disconnect"],
      { encoding: "utf8", timeout: 15000, maxBuffer: 65536 },
    );
    if (stdout.trim() !== "0") throw new Error("Connection rejected.");
  } catch {
    throw new Error(
      "Bluetooth connection failed or timed out. Check macOS Bluetooth permission, or configure an installed blueutil executable.",
    );
  }
};
