# Camera

- Independent Bun + TypeScript project (build only; no Node at runtime). Preserve `com.izsk.camera`.
- Keep it small: a live preview with a footer (Capture ↩, Actions ⌘K, Close ⎋), a photo, a camera
  switch and mirroring. No video recording or microphone.
- Alfred has no camera usage description, so nothing Alfred runs can use the camera. `bin/camera`
  builds `Camera Preview.app` from `bin/preview.js` with `osacompile -s` on the user's Mac (its own
  bundle id and NSCameraUsageDescription, ad-hoc signed), so macOS asks that app for the camera.
  Nothing compiled is committed or downloaded.
- Each build goes to `<data>/v-<hash of preview.js>/`, so updates never delete files. The toggle
  closes a running preview with `pkill`; in the preview, dragging moves it and Escape closes it.
- In JXA, AVFoundation classes come from `NSClassFromString` after loading the framework bundle
  (`ObjC.import("AVFoundation")` doesn't expose them); constants are passed as strings ("vide").
- Never set CALayer colours (`backgroundColor`, `borderColor`) from JXA: passing `NSColor.CGColor`
  crashes the app. Colours go through `NSBox` (custom box: fillColor, borderColor, cornerRadius).
- Every action goes through `safe()`, which writes failures to `preview-error.txt` in the data folder.
