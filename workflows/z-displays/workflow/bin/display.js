// Displays through CoreGraphics, from JXA (no compiled helper to sign or install).
//   osascript -l JavaScript display.js list                 → JSON: displays with their modes, plus Dark Mode
//   osascript -l JavaScript display.js mode <display> <mode> → switch resolution / refresh rate (IO mode id)
//   osascript -l JavaScript display.js main <display>        → make it the main display (menu bar)
//   osascript -l JavaScript display.js mirror <display> on|off
//   osascript -l JavaScript display.js dark on|off|toggle
// Functions are bound with ObjC.bindFunction (`void *` / `void **`): BridgeSupport struct pointers
// crash osascript. Changes are applied with kCGConfigurePermanently so they survive a restart.
ObjC.import("AppKit");
const bind = (name, ret, args) => ObjC.bindFunction(name, [ret, args]);
bind("malloc", "void *", ["int"]);
bind("free", "void", ["void *"]);
bind("CGGetOnlineDisplayList", "int", ["unsigned int", "void *", "void *"]);
bind("CGDisplayCopyAllDisplayModes", "void *", ["unsigned int", "void *"]);
bind("CGDisplayCopyDisplayMode", "void *", ["unsigned int"]);
bind("CFArrayGetCount", "long", ["void *"]);
bind("CFArrayGetValueAtIndex", "void *", ["void *", "long"]);
bind("CGDisplayModeGetWidth", "unsigned long", ["void *"]);
bind("CGDisplayModeGetHeight", "unsigned long", ["void *"]);
bind("CGDisplayModeGetPixelWidth", "unsigned long", ["void *"]);
bind("CGDisplayModeGetPixelHeight", "unsigned long", ["void *"]);
bind("CGDisplayModeGetRefreshRate", "double", ["void *"]);
bind("CGDisplayModeGetIODisplayModeID", "int", ["void *"]);
bind("CGDisplayModeGetIOFlags", "unsigned int", ["void *"]);
bind("CGDisplayModeIsUsableForDesktopGUI", "bool", ["void *"]);
bind("CGDisplayIsMain", "bool", ["unsigned int"]);
bind("CGDisplayIsBuiltin", "bool", ["unsigned int"]);
bind("CGDisplayMirrorsDisplay", "unsigned int", ["unsigned int"]);
bind("CGMainDisplayID", "unsigned int", []);
bind("CGBeginDisplayConfiguration", "int", ["void **"]);
bind("CGConfigureDisplayWithDisplayMode", "int", ["void *", "unsigned int", "void *", "void *"]);
bind("CGConfigureDisplayOrigin", "int", ["void *", "unsigned int", "int", "int"]);
bind("CGConfigureDisplayMirrorOfDisplay", "int", ["void *", "unsigned int", "unsigned int"]);
bind("CGCompleteDisplayConfiguration", "int", ["void *", "unsigned int"]);
bind("CGCancelDisplayConfiguration", "int", ["void *"]);

const PERMANENTLY = 2;
const NATIVE_FLAG = 0x02000000;
// HiDPI ("looks like") modes are only listed with this option.
const OPTIONS = $.NSDictionary.dictionaryWithObjectForKey(
  $.NSNumber.numberWithBool(true),
  "kCGDisplayShowDuplicateLowResolutionModes",
);
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
/** Bytes at a pointer, as a JS array (NSData → base64 → bytes). */
const read = (pointer, length) => {
  const text = ObjC.unwrap($.NSData.dataWithBytesLength(pointer, length).base64EncodedStringWithOptions(0));
  const out = [];
  let buf = 0,
    bits = 0;
  for (const ch of text.replace(/=+$/, "")) {
    buf = ((buf << 6) | B64.indexOf(ch)) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 255);
    }
  }
  return out;
};
const u32s = (b) => {
  const out = [];
  for (let i = 0; i + 3 < b.length; i += 4) out.push((b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0);
  return out;
};

const describeMode = (m) => ({
  id: $.CGDisplayModeGetIODisplayModeID(m),
  width: $.CGDisplayModeGetWidth(m),
  height: $.CGDisplayModeGetHeight(m),
  pixelWidth: $.CGDisplayModeGetPixelWidth(m),
  pixelHeight: $.CGDisplayModeGetPixelHeight(m),
  hz: Math.round($.CGDisplayModeGetRefreshRate(m) * 100) / 100,
  native: ($.CGDisplayModeGetIOFlags(m) & NATIVE_FLAG) !== 0,
});
const modeRefs = (id) => {
  const all = $.CGDisplayCopyAllDisplayModes(id, OPTIONS);
  const refs = [];
  for (let i = 0; i < $.CFArrayGetCount(all); i++) {
    const m = $.CFArrayGetValueAtIndex(all, i);
    if ($.CGDisplayModeIsUsableForDesktopGUI(m)) refs.push(m);
  }
  return refs;
};
/** Every attached display, mirrored ones too (NSScreen leaves those out). */
const displayIds = () => {
  const list = $.malloc(32 * 4),
    count = $.malloc(4);
  try {
    if ($.CGGetOnlineDisplayList(32, list, count) !== 0) return [];
    const n = u32s(read(count, 4))[0] || 0;
    return u32s(read(list, n * 4));
  } finally {
    $.free(list);
    $.free(count);
  }
};
/** Display names come from NSScreen; a mirrored display has no screen of its own. */
const screens = () => {
  const map = {};
  const all = $.NSScreen.screens;
  for (let i = 0; i < all.count; i++) {
    const s = all.objectAtIndex(i);
    map[ObjC.unwrap(s.deviceDescription.objectForKey("NSScreenNumber"))] = s;
  }
  return map;
};
const dark = () =>
  ObjC.unwrap($.NSUserDefaults.standardUserDefaults.stringForKey("AppleInterfaceStyle")) === "Dark";

const list = () => {
  const named = screens();
  return {
    dark: dark(),
    displays: displayIds().map((id) => {
      const current = $.CGDisplayCopyDisplayMode(id);
      const screen = named[id];
      return {
        id,
        name: screen
          ? ObjC.unwrap(screen.localizedName)
          : $.CGDisplayIsBuiltin(id)
            ? "Built-in Display"
            : `Display ${id}`,
        main: $.CGDisplayIsMain(id),
        builtin: $.CGDisplayIsBuiltin(id),
        mirrorOf: $.CGDisplayMirrorsDisplay(id),
        current: current ? describeMode(current) : null,
        modes: modeRefs(id).map(describeMode),
      };
    }),
  };
};

/** Runs `apply(config)` inside one display configuration, applied permanently. */
const configure = (apply) => {
  const ref = Ref();
  let status = $.CGBeginDisplayConfiguration(ref);
  if (status !== 0) throw new Error(`macOS refused to change displays (${status}).`);
  try {
    status = apply(ref[0]);
  } catch (error) {
    $.CGCancelDisplayConfiguration(ref[0]);
    throw error;
  }
  if (status !== 0) {
    $.CGCancelDisplayConfiguration(ref[0]);
    throw new Error(`macOS refused to change displays (${status}).`);
  }
  status = $.CGCompleteDisplayConfiguration(ref[0], PERMANENTLY);
  if (status !== 0) throw new Error(`macOS refused to change displays (${status}).`);
  return { ok: true };
};
const known = (id) => {
  if (!displayIds().includes(id)) throw new Error("That display is no longer connected.");
  return id;
};

const setMode = (display, modeId) => {
  const id = known(display);
  const mode = modeRefs(id).find((m) => $.CGDisplayModeGetIODisplayModeID(m) === modeId);
  if (!mode) throw new Error("That mode is not available on this display.");
  return configure((config) => $.CGConfigureDisplayWithDisplayMode(config, id, mode, null));
};

/** Moves every display so the chosen one sits at the origin, which makes it the main display. */
const setMain = (display) => {
  const id = known(display);
  const named = screens();
  if (!named[id]) throw new Error("A mirrored display can't be the main display.");
  const frames = Object.entries(named).map(([sid, s]) => [Number(sid), s.frame]);
  const mainHeight = (frames.find(([sid]) => $.CGDisplayIsMain(sid)) || frames[0])[1].size.height;
  // NSScreen frames are bottom-left based; CoreGraphics origins are top-left of the main display.
  const top = (f) => ({ x: f.origin.x, y: mainHeight - (f.origin.y + f.size.height) });
  const target = top(named[id].frame);
  return configure((config) => {
    for (const [sid, f] of frames) {
      const p = top(f);
      const status = $.CGConfigureDisplayOrigin(config, sid, p.x - target.x, p.y - target.y);
      if (status !== 0) return status;
    }
    return 0;
  });
};

const setMirror = (display, on) => {
  const id = known(display);
  if (on && $.CGDisplayIsMain(id)) throw new Error("Choose another display to mirror the main one.");
  return configure((config) =>
    $.CGConfigureDisplayMirrorOfDisplay(config, id, on ? $.CGMainDisplayID() : 0),
  );
};

/** Dark Mode goes through System Events (macOS asks once to let Alfred control it). */
const setDark = (value) => {
  const next = value === "toggle" ? !dark() : value === "on";
  Application("System Events").appearancePreferences.darkMode = next;
  return { ok: true, dark: next };
};

function run(argv) {
  try {
    const [command, a, b] = argv;
    const result =
      command === "mode"
        ? setMode(Number(a), Number(b))
        : command === "main"
          ? setMain(Number(a))
          : command === "mirror"
            ? setMirror(Number(a), b === "on")
            : command === "dark"
              ? setDark(a)
              : list();
    return JSON.stringify(result);
  } catch (error) {
    return JSON.stringify({ error: String(error && error.message ? error.message : error) });
  }
}
