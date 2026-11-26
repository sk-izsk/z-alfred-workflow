# Verification

Two tests / six assertions: Wi-Fi hardware detection, saved/nearby network merge, current-name redaction, signal/security metadata and radio status. Check/package pass. Read-only native interface and system Wi-Fi report probes succeeded. The unsupported JXA scan bridge crashed with SIGSEGV and is excluded from implementation. No connect/disconnect or power changes were made for testing. Native UI and connection controls still need user-network verification.

Five tests / 19 assertions cover the interface-summary fallback, current/saved deduplication, redacted association and Wi-Fi-off state. A read-only live scan detects one connected network among eight rows, with its SSID hidden by macOS. No real credentials were retrieved, and connectivity mutations remain untested.
