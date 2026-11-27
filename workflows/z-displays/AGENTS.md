# Displays

- Independent Bun + TypeScript project; generate UI/plist from source. Preserve `com.izsk.displays`.
- Displays are read and changed by `workflow/bin/display.js` (JXA + CoreGraphics), run with
  `/usr/bin/osascript`. Bind C functions with `ObjC.bindFunction` (`void *`, and `void **` for
  `CGBeginDisplayConfiguration`); never call them through BridgeSupport structs (see the root
  AGENTS.md, "macOS APIs without a compiled helper").
- Changes use `kCGConfigurePermanently`. Every resolution change keeps the previous mode for ⌘Z.
  Test changes by re-applying the current mode only; never switch the user's displays to test.
- Two levels: displays, then one display's resolutions. Back returns one level, then to Swiss.
