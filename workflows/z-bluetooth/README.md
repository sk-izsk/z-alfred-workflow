# Bluetooth for Alfred 6

Type `bluetooth` or choose Bluetooth in `dev`. Lists paired devices, connected first, with device type and any battery fields reported by macOS. Filter All/Connected/Disconnected. Return connects/disconnects the selected device. Command-K offers connection action, Copy MAC Address, Copy Device Data, Refresh, Pause/Resume, Bluetooth Settings and Workflow Configuration.

Uses macOS system_profiler for metadata and IOBluetooth for connection requests. If an existing blueutil installation is found, it handles connection changes instead; an optional absolute executable path is configurable. Nothing is installed automatically. macOS Bluetooth permission and device support may be required; failed/timed-out requests show an error. Battery data is omitted when unavailable, rather than estimated. Metadata refresh defaults to 10 seconds while open; configure 2–60 seconds or pause it. No radio power toggle or pairing operation is exposed; use Bluetooth Settings for those.

Visible configurable Hyper+B returns one level or to the previous Dev launcher session. Standard width 780, screen-aware sizing, and compact footer labels follow UI_CONVENTIONS.md. Independent workflow requiring Node.js or Bun. Build with `bun run check`, `bun run package`, install locally with `bun run link`.

Built with help from AI tools. Inspired by [Toothpick](https://github.com/raycast/extensions/tree/c4e0f79975a011e16032382f2d1263f712f8b43c/extensions/toothpick/). No connection was changed for verification.
