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
  expect(rows[0]!.batteries).toEqual([
    { part: "left", percent: 72 },
    { part: "right", percent: 74 },
  ]);
  expect(rows[1]!.battery).toBe("");
  expect(validAddress("bad;echo x")).toBe(false);
});

test("paired devices remain visible when macOS omits their address", () => {
  const rows = parse({
    SPBluetoothDataType: [{ device_not_connected: [{ Example: { device_minorType: "Keyboard" } }] }],
  });
  expect(rows).toHaveLength(1);
  expect(rows[0]!.hidden).toBe(true);
  expect(validAddress(rows[0]!.id)).toBe(false);
});

test("only real Bluetooth addresses reach blueutil", async () => {
  const { connect } = await import("../src/bluetooth.ts");
  expect(validAddress("a4:83:e7:12:34:56")).toBe(true);
  expect(validAddress("A4-83-E7-12-34-56")).toBe(true);
  for (const bad of ["", "a4:83:e7:12:34", "a4:83:e7:12:34:56:78", "--connect", "a4:83:e7:12:34:5g"])
    expect(validAddress(bad)).toBe(false);
  await expect(connect("--disconnect", true)).rejects.toThrow("Invalid Bluetooth address");
});
