import { expect, test } from "bun:test";
import { parse, validAddress } from "../src/bluetooth.ts";
test("Bluetooth metadata maps connection, type and available battery fields", () => {
  const rows = parse({
    SPBluetoothDataType: [
      {
        device_connected: [
          {
            Headset: {
              device_address: "AA-BB-CC-DD-EE-FF",
              device_minorType: "Headphones",
              device_batteryLevelLeft: "72%",
              device_batteryLevelRight: "74%",
            },
          },
        ],
        device_not_connected: [
          { Keyboard: { device_address: "11:22:33:44:55:66", device_minorType: "Keyboard" } },
          { Invalid: { device_address: "bad" } },
        ],
      },
    ],
  });
  expect(rows).toHaveLength(2);
  expect(rows[0]!.connected).toBe(true);
  expect(rows[0]!.battery).toContain("Left 72%");
  expect(rows[1]!.battery).toBe("");
  expect(validAddress("bad;echo x")).toBe(false);
});
