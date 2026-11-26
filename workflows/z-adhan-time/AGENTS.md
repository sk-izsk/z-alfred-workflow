# Adhan Time

- Independent Bun + TypeScript project; preserve com.izsk.adhan-time and generate UI/plist.
- Prayer clocks are in the provider's IANA timezone. Never interpret them in the Mac's timezone.
- Sunrise is informational and never a next prayer. After Isha use the next date, including month rollover.
- Preserve verified Aladhan method IDs; several labels in the Raycast reference have different IDs.
- Missing or invalid times stay unknown. Cached fallback keeps its original dates/timestamp and is marked.
- Keep Back visible outside Actions, including Settings and calculation details sheets.
- Settings/API tests use temporary directories, mocked fetch and synthetic data.
- Preserve notices and AI disclosure; run check, package and UI checker.
