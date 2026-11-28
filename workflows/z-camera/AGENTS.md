# Camera

- Independent Bun + TypeScript project (build only; no Node at runtime). Preserve `com.izsk.camera`.
- One job: show a mirrored live camera preview with no controls, and hide it. Keep it that simple.
- Alfred has no camera usage description, so nothing Alfred runs can use the camera. `bin/camera`
  builds `Camera Preview.app` from `bin/preview.js` with `osacompile -s` on the user's Mac (its own
  bundle id and NSCameraUsageDescription, ad-hoc signed), so macOS asks that app for the camera.
  Nothing compiled is committed or downloaded.
- Each build goes to `<data>/v-<hash of preview.js>/`, so updates never delete files. The toggle
  closes a running preview with `pkill`; the preview also closes on a click or any key.
- In JXA, AVFoundation classes come from `NSClassFromString` after loading the framework bundle
  (`ObjC.import("AVFoundation")` doesn't expose them); constants are passed as strings ("vide").
