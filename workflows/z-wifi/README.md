# Wi-Fi for Alfred 6

Type `wifi` or choose Wi-Fi in `dev`. Shows the native Wi-Fi interface, current/nearby networks reported by macOS and saved networks. Rows show connection state, security and signal/noise when available. Return disconnects the current network or attempts a saved-network connection using macOS credentials. New networks/passwords use Wi-Fi Settings; the workflow does not collect or save Wi-Fi passwords.

Command-K offers Connect Saved Network/Disconnect, Copy Network Name, Copy Network Data, Refresh, Pause/Resume, Turn Wi-Fi On/Off, Wi-Fi Settings and Configuration. Connection and power controls run only after an explicit action. Refresh defaults to 10 seconds while open, configurable 2–60 seconds. system_profiler reports may take several seconds.

macOS can redact network names. A connected network with a hidden name is labeled honestly; saved networks remain available when the system exposes them. A privacy note is shown rather than inventing a current SSID. Nearby results come from the system Wi-Fi report; the CoreWLAN scan bridge crashed in a bounded read-only probe and is not used. Disconnect uses the no-argument CoreWLAN disassociate method; connection/power changes have not been exercised on the user’s network. Open Wi-Fi Settings if macOS denies a request.

Visible configurable Hyper+B restores the Dev launcher’s prior search and selection. Standard width 780 and screen-aware sizing follow UI_CONVENTIONS.md. Independent workflow; Node.js or Bun required. Development: `bun run check`, `bun run package`, `bun run link`.

Built with help from AI tools. Uses Apple CoreWLAN, system_profiler and networksetup. Connectivity UI follows the requested Toothpick-style workflow, independently adapted for Wi-Fi.
