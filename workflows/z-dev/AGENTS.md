# Dev launcher

- Independent Bun + TypeScript workflow; generate UI/plist and preserve com.izsk.dev.
- Registry is src/tools.ts. Each tool stays independently installable; no backend starts in the menu.
- Add a registry entry, copied/credited icon and tool-side Dev v1 support for new tools.
- Use only fixed registry bundle IDs and validated session IDs. Never accept an arbitrary return target.
- Preserve query and selection when resuming; Back stays visible outside Actions.
- Detect missing/old tools but never install or update them at runtime. Camera is deferred.
- Run check/package and UI checker; include all tool-icon notices, never prefs or caches.
