# Menu Bar

- Independent Bun + TypeScript project; generate UI/plist from source. Preserve `com.izsk.menubar`.
- Menus are read and clicked by `workflow/bin/menus.js` (JXA + Accessibility C API bound with
  `ObjC.bindFunction`). In JXA, `NSArray.count` arrives as a string: always `Number(array.count)`.
- The target app is the menu bar owner; while Alfred owns it, the frontmost non-Alfred window's app.
- A Script Filter, not a window: results appear as the keyword is typed (the user's choice over an
  Alfred UI window, so there is no Back/Actions footer). The last list per app shows first, then a
  `rerun` reads live. Swiss opens it through the External Trigger, which types the keyword.
- Clicking happens after Alfred closes, by index path, and only when every title still matches.
  Never click items to test; tests use synthetic menus.
