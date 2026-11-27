# Drives

- Independent Bun + TypeScript project; generate UI/plist from source. Preserve `com.izsk.drives`.
- Volumes come from `workflow/bin/volumes.js` (JXA, NSFileManager, hidden volumes skipped); opened
  disk images from `hdiutil info -plist`, so a DMG is listed even when mounted hidden or outside
  /Volumes. Images under /System are macOS's own and stay out.
- Eject with `diskutil` (eject for disks and images, unmount for network shares). When macOS refuses,
  name the dissenting app. ↩ only opens: Eject, Force Eject and Eject All live in ⌘K, and the last two always ask first. Never eject a drive to test
  except a throwaway image you created.
- Tests use synthetic names and paths only.
