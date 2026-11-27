# Camera

- Independent Bun + TypeScript project (build only; no Node at runtime). Preserve `com.izsk.camera`.
- Alfred has no camera permission (no NSCameraUsageDescription), so nothing Alfred runs can open the
  camera: a web view's getUserMedia or AVFoundation from osascript is denied. QuickTime Player shows
  the preview instead, driven by `workflow/bin/camera.js` (JXA). Keep it muted; never start a
  recording or save.
- `cam` is a Script Filter (Show/Hide, Take Photo, Switch Camera, Open Photos Folder). The preview
  closes with saving no and quits QuickTime if the preview had started it. The script prints a
  message (saved photo, error) that becomes a notification.
- QuickTime's scripting can count cameras and set one by index, but can't read device names on
  current macOS ("Can't get object"): Switch Camera cycles by index. A photo is a `screencapture -R`
  of the preview below its title bar (`sips --cropOffset` doesn't crop here).
