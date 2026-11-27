// Menu bar items of the app you are using, through the Accessibility API from JXA (no compiled helper).
//   osascript -l JavaScript menus.js owner                → JSON: the app whose menus would be listed
//   osascript -l JavaScript menus.js list [pid] [apple]   → JSON: the app and every menu item (leafs)
//   osascript -l JavaScript menus.js press <pid> <indexes> <titles>   → click one item
// Items are found again by index path and checked against their titles, so a menu that changed in
// between is never clicked by mistake. Alfred needs Accessibility permission (System Settings →
// Privacy & Security → Accessibility), which it normally has already.
ObjC.import("AppKit");
ObjC.import("CoreGraphics");
ObjC.bindFunction("AXIsProcessTrusted", ["bool", []]);
ObjC.bindFunction("AXUIElementCreateApplication", ["id", ["int"]]);
ObjC.bindFunction("AXUIElementCopyAttributeValue", ["int", ["id", "id", "id *"]]);
ObjC.bindFunction("AXUIElementPerformAction", ["int", ["id", "id"]]);

const MAX_DEPTH = 5;
const MAX_ITEMS = 4000;
const ALFRED = "com.runningwithcrayons.Alfred";
const get = (el, attr) => {
  const out = Ref();
  return $.AXUIElementCopyAttributeValue(el, $(attr), out) === 0 ? out[0] : null;
};
// NSArray.count reaches JS as a string here ("0" is truthy): always convert.
const count = (array) => (array ? Number(array.count) : 0);
const text = (value) => {
  const v = value ? ObjC.unwrap(value) : null;
  return typeof v === "string" ? v : "";
};
const number = (value) => {
  const v = value ? ObjC.unwrap(value) : null;
  return typeof v === "number" ? v : null;
};

const describeApp = (app) => ({
  pid: app.processIdentifier,
  name: text(app.localizedName),
  bundle: text(app.bundleIdentifier),
  path: text(app.bundleURL.path),
});
/**
 * The app whose menus to list: the menu bar owner, or, while Alfred owns it, the app of the frontmost
 * window that isn't Alfred's.
 */
const targetApp = (pid) => {
  const ws = $.NSWorkspace.sharedWorkspace;
  if (pid) return $.NSRunningApplication.runningApplicationWithProcessIdentifier(pid);
  const owner = ws.menuBarOwningApplication;
  if (owner && text(owner.bundleIdentifier) !== ALFRED) return owner;
  const windows = ObjC.deepUnwrap($.CGWindowListCopyWindowInfo(1 | 16, 0));
  for (const w of windows || []) {
    if (w.kCGWindowLayer !== 0 || /Alfred/.test(w.kCGWindowOwnerName || "")) continue;
    const app = $.NSRunningApplication.runningApplicationWithProcessIdentifier(w.kCGWindowOwnerPID);
    if (app && Number(app.activationPolicy) === 0) return app;
  }
  return owner;
};

const list = (pid, withApple) => {
  if (!$.AXIsProcessTrusted())
    throw new Error("Alfred needs Accessibility access: System Settings → Privacy & Security → Accessibility.");
  const app = targetApp(pid);
  if (!app) throw new Error("No app with menus is in front.");
  const bar = get($.AXUIElementCreateApplication(app.processIdentifier), "AXMenuBar");
  if (!bar) throw new Error(`${text(app.localizedName)} has no menu bar.`);
  const items = [];
  const walk = (element, titles, indexes, depth) => {
    const children = get(element, "AXChildren");
    for (let i = 0; i < count(children) && items.length < MAX_ITEMS; i++) {
      const child = children.objectAtIndex(i);
      const title = text(get(child, "AXTitle"));
      const sub = get(child, "AXChildren");
      // Menu bar items and submenu items hold an AXMenu; the AXMenu holds the items.
      if (count(sub)) {
        if (depth < MAX_DEPTH) walk(child, title ? [...titles, title] : titles, [...indexes, i], depth + 1);
        continue;
      }
      if (!title) continue; // separators
      items.push({
        titles: [...titles, title],
        indexes: [...indexes, i],
        enabled: get(child, "AXEnabled") ? ObjC.unwrap(get(child, "AXEnabled")) === true : true,
        key: text(get(child, "AXMenuItemCmdChar")),
        glyph: number(get(child, "AXMenuItemCmdGlyph")),
        mods: number(get(child, "AXMenuItemCmdModifiers")) ?? 0,
      });
    }
  };
  const top = get(bar, "AXChildren");
  // The Apple menu is the first menu bar item; it's the same in every app.
  for (let i = withApple ? 0 : 1; i < count(top); i++) {
    const item = top.objectAtIndex(i);
    walk(item, [text(get(item, "AXTitle"))], [i], 1);
  }
  return { app: describeApp(app), items };
};

/** Finds an item by its index path, checks every title on the way, and presses it. */
const press = (pid, indexes, titles) => {
  const bar = get($.AXUIElementCreateApplication(pid), "AXMenuBar");
  if (!bar) throw new Error("That app has quit.");
  let element = bar;
  for (let level = 0; level < indexes.length; level++) {
    // Below the menu bar, each menu item's children are one AXMenu holding the next level.
    const holder = level === 0 ? element : get(element, "AXChildren")?.objectAtIndex(0);
    const children = holder ? get(holder, "AXChildren") : null;
    if (indexes[level] >= count(children)) throw new Error("The menu changed. Try again.");
    element = children.objectAtIndex(indexes[level]);
  }
  const found = text(get(element, "AXTitle"));
  if (found !== titles[titles.length - 1]) throw new Error("The menu changed. Try again.");
  if ($.AXUIElementPerformAction(element, $("AXPress")) !== 0) throw new Error(`Couldn't click “${found}”.`);
  return { ok: true, title: found };
};

function run(argv) {
  try {
    const [command, a, b, c] = argv;
    const result =
      command === "owner"
        ? describeApp(targetApp(0))
        : command === "press"
        ? press(Number(a), JSON.parse(b), JSON.parse(c))
        : list(a ? Number(a) : 0, b === "apple");
    return JSON.stringify(result);
  } catch (error) {
    return JSON.stringify({ error: String(error && error.message ? error.message : error) });
  }
}
