# Menu Bar

- Independent Bun + TypeScript project; generate UI/plist from source. Preserve `com.izsk.menubar`.
- Menus are read and clicked by `workflow/bin/menus.js` (JXA + Accessibility C API bound with
  `ObjC.bindFunction`). In JXA, `NSArray.count` arrives as a string: always `Number(array.count)`.
- The target app is the menu bar owner; while Alfred owns it, the frontmost non-Alfred window's app.
- Clicking happens in the post script after the window closes, by index path, and only when every
  title still matches. Never click items to test; tests use synthetic menus.
