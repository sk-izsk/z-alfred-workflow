import { expect, test } from "bun:test";
import { hardware, parse } from "../src/wifi.ts";
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
