# Shortcuts

- Independent Bun + TypeScript project; generate UI/plist from source. Preserve `com.izsk.shortcuts`.
- Shortcuts are read with `/usr/bin/shortcuts` (no permission). Input support comes from Shortcuts
  Events through `osascript`, which needs Alfred's Automation permission: keep it optional, with a
  short timeout, and never block the list on it.
- Running and editing go through Alfred's native Run Shortcut object and Shortcuts automation task,
  not a reimplementation. Typed input reaches scripts as environment variables, never argv.
- Visible configurable Back in every footer and sheet; Back from the first screen returns to Swiss
  when opened there. Tests use synthetic shortcut names only.
