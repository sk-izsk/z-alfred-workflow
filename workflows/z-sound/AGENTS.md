# Sound

- Independent Bun + TypeScript project; generate UI/plist from source. Preserve `com.izsk.sound`.
- Devices are read and switched by `workflow/bin/audio.js` (JXA + CoreAudio), run with
  `/usr/bin/osascript`. Never import CoreAudio's BridgeSupport there: its struct-pointer signatures
  crash osascript (exit 139). Bind functions with `ObjC.bindFunction` and `void *` arguments, pass
  `malloc`'d memory filled and read through `NSData`, and read CFString properties with an `id *` out
  argument.
- Devices are addressed by UID (stable), never by CoreAudio ID (changes on reconnect).
- Visible configurable Back in every footer; Back from the first screen returns to Swiss when opened
  there. Tests use synthetic device names only.
