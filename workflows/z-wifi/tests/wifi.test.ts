import { expect, test } from "bun:test";
import { hardware, parse, association, passwordDialog } from "../src/wifi.ts";
test("hardware parser selects Wi-Fi rather than Ethernet", () => {
  expect(hardware("Hardware Port: Ethernet\nDevice: en0\n\nHardware Port: Wi-Fi\nDevice: en1\n")).toBe("en1");
});
test("network mapping merges saved networks and reports redacted current names honestly", () => {
  const raw = {
    SPAirPortDataType: [
      {
        spairport_airport_interfaces: [
          {
            _name: "en1",
            spairport_current_network_information: {
              _name: "<redacted>",
              spairport_security_mode: "WPA2",
              spairport_network_channel: "36",
            },
            spairport_airport_other_local_wireless_networks: [
              { _name: "Test Net", spairport_security_mode: "WPA2", spairport_signal_noise: "-55 / -90" },
            ],
          },
        ],
      },
    ],
  };
  const snapshot = parse(raw, ["Test Net", "Other Saved"], "en1", true);
  expect(snapshot.rows).toHaveLength(3);
  expect(snapshot.rows[0]!.hidden).toBe(true);
  expect(snapshot.rows.find((x) => x.name === "Test Net")!.saved).toBe(true);
  expect(snapshot.note).toContain("hides network names");
  expect(snapshot.power).toBe(true);
});

test("interface summary restores a connected SSID omitted from system_profiler", () => {
  const link = association(
    "<dictionary> {\n  InterfaceType : WiFi\n  LinkStatusActive : TRUE\n  SSID : Current Net\n  Security : WPA2_PSK\n}",
  );
  const result = parse({}, ["Current Net", "Other"], "en1", true, link);
  expect(result.rows[0]!.name).toBe("Current Net");
  expect(result.rows[0]!.connected).toBe(true);
  expect(result.rows[0]!.saved).toBe(true);
  expect(result.rows.filter((row) => row.connected)).toHaveLength(1);
  const hidden = parse({}, ["Other"], "en1", true, { ...link, name: "" });
  expect(hidden.rows[0]!.hidden).toBe(true);
  expect(hidden.rows[0]!.connected).toBe(true);
  expect(parse({}, ["Other"], "en1", false, link).rows.some((row) => row.connected)).toBe(false);
  expect(association("  InterfaceType : Ethernet\n  LinkStatusActive : TRUE").connected).toBe(false);
});
test("report association state remains visible when both sources redact the SSID", () => {
  const result = parse(
    {
      SPAirPortDataType: [
        {
          spairport_airport_interfaces: [
            { _name: "en1", spairport_status_information: "spairport_status_connected" },
          ],
        },
      ],
    },
    ["Saved"],
    "en1",
    true,
  );
  expect(result.rows[0]!.connected).toBe(true);
  expect(result.rows[0]!.hidden).toBe(true);
});

test("password dialog escapes text as a literal and returns no credential", () => {
  const script = passwordDialog('test"\\\ncredential', 'Example "Network"');
  expect(script).toContain('test\\"\\\\\\ncredential');
  expect(script).toContain('return ""');
  expect(script).toContain("giving up after 60");
});
