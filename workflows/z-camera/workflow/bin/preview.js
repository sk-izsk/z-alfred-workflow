// Camera Preview: a small app that shows the camera with a footer like the Alfred workflows':
//   Capture ↩   Actions ⌘K   Close ⎋
// The workflow builds it with osacompile on this Mac (bin/camera), so it has its own camera
// permission: Alfred can't use the camera itself. Drag it to move it.
// Settings come from preview.json in the workflow's data folder:
// {"width": 880, "corner": "centre", "mirror": true, "mirrorPhotos": false, "folder": "~/Pictures/Camera"}.
ObjC.import("AppKit");
$.NSBundle.bundleWithPath("/System/Library/Frameworks/AVFoundation.framework").load;
const cls = (name) => $.NSClassFromString(name);
const MARGIN = 20;
const FOOTER = 34;
const ESCAPE = 53;
const RETURN = 36;
const ENTER = 76;
const COMMAND = 1 << 20;
const SHUTTER = "/System/Library/Components/CoreAudio.component/Contents/SharedSupport/SystemSounds/system/Shutter.aif";
// Kept alive while the app runs.
var session, previewWindow, previewLayer, photoOutput, statusLabel, footerView, flashView, target, input;
var options = {};
var lastPhoto = "";

const settings = () => {
  const data = $.NSBundle.mainBundle.bundlePath.stringByDeletingLastPathComponent.stringByDeletingLastPathComponent;
  try {
    return JSON.parse(
      ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(`${ObjC.unwrap(data)}/preview.json`, 4, null)),
    );
  } catch {
    return {};
  }
};
/** Runs an action; a failure is written to preview-error.txt instead of being lost. */
const safe = (fn) => (...args) => {
  try {
    return fn(...args);
  } catch (error) {
    const data = $.NSBundle.mainBundle.bundlePath.stringByDeletingLastPathComponent.stringByDeletingLastPathComponent;
    $(`${new Date().toISOString()} ${error}`).writeToFileAtomicallyEncodingError(
      `${ObjC.unwrap(data)}/preview-error.txt`,
      true,
      4,
      null,
    );
    return undefined;
  }
};
const home = ObjC.unwrap($.NSHomeDirectory());
const photoFolder = () => String(options.folder || "~/Pictures/Camera").replace(/^~(?=\/|$)/, home);
const stamp = () => {
  const f = $.NSDateFormatter.alloc.init;
  f.dateFormat = "yyyy-MM-dd 'at' HH.mm.ss";
  return ObjC.unwrap(f.stringFromDate($.NSDate.date));
};
const cameras = () => {
  const list = cls("AVCaptureDevice").devicesWithMediaType("vide");
  const out = [];
  for (let i = 0; i < Number(list.count); i++) out.push(list.objectAtIndex(i));
  return out;
};
const status = (text, seconds = 0) => {
  statusLabel.stringValue = text;
  if (seconds) target.performSelectorWithObjectAfterDelay("resetStatus", null, seconds);
};
const setMirror = (connection, on) => {
  if (!connection || connection.isNil() || !connection.isVideoMirroringSupported) return;
  connection.automaticallyAdjustsVideoMirroring = false;
  connection.videoMirrored = on;
};

// --- Actions -----------------------------------------------------------------------------------

const capture = () => {
  setMirror(photoOutput.connectionWithMediaType("vide"), Boolean(options.mirrorPhotos));
  const format = $.NSDictionary.dictionaryWithObjectForKey("jpeg", "AVVideoCodecKey");
  const photoSettings = cls("AVCapturePhotoSettings").photoSettingsWithFormat(format);
  photoOutput.capturePhotoWithSettingsDelegate(photoSettings, target);
  flashView.hidden = false;
  target.performSelectorWithObjectAfterDelay("endFlash", null, 0.12);
  if (options.sound !== false) {
    const sound = $.NSSound.alloc.initWithContentsOfFileByReference(SHUTTER, true);
    if (!sound.isNil()) sound.play;
  }
};
const savePhoto = (photo, error) => {
  if (error && !error.isNil()) return status(`Couldn't take a photo: ${ObjC.unwrap(error.localizedDescription)}`, 4);
  const data = photo.fileDataRepresentation;
  const folder = photoFolder();
  $.NSFileManager.defaultManager.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(folder, true, $(), null);
  const file = `${folder}/Camera ${stamp()}.jpg`;
  if (!data || data.isNil() || !data.writeToFileAtomically(file, true)) return status("Couldn't save the photo.", 4);
  lastPhoto = file;
  status(`Saved ${file.split("/").pop()}`, 3);
};
const switchTo = (uniqueID) => {
  const device = cameras().find((d) => ObjC.unwrap(d.uniqueID) === uniqueID);
  if (!device) return;
  const next = cls("AVCaptureDeviceInput").deviceInputWithDeviceError(device, null);
  if (next.isNil()) return;
  session.beginConfiguration;
  session.removeInput(input);
  if (session.canAddInput(next)) {
    session.addInput(next);
    input = next;
  } else session.addInput(input);
  session.commitConfiguration;
  setMirror(previewLayer.connection, Boolean(options.mirror));
  status(ObjC.unwrap(input.device.localizedName), 2);
};
const reveal = () => {
  if (lastPhoto) $.NSWorkspace.sharedWorkspace.activateFileViewerSelectingURLs($([$.NSURL.fileURLWithPath(lastPhoto)]));
  else status("No photo yet: press ↩ to take one.", 3);
};
const openFolder = () => {
  $.NSFileManager.defaultManager.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(photoFolder(), true, $(), null);
  $.NSWorkspace.sharedWorkspace.openURL($.NSURL.fileURLWithPath(photoFolder()));
};
const item = (title, action, key = "", mask = 0) => {
  const m = $.NSMenuItem.alloc.initWithTitleActionKeyEquivalent(title, action, key);
  m.keyEquivalentModifierMask = mask;
  m.target = target;
  return m;
};
const showMenu = () => {
  const menu = $.NSMenu.alloc.initWithTitle("Actions");
  menu.addItem(item("Capture", "capture:", "\r", 0));
  const sub = $.NSMenu.alloc.initWithTitle("Switch Camera");
  const current = ObjC.unwrap(input.device.uniqueID);
  for (const d of cameras()) {
    const m = item(ObjC.unwrap(d.localizedName), "switchCamera:");
    m.representedObject = d.uniqueID;
    m.state = ObjC.unwrap(d.uniqueID) === current ? 1 : 0;
    sub.addItem(m);
  }
  const switcher = item("Switch Camera", null);
  switcher.submenu = sub;
  menu.addItem(switcher);
  const mirror = item("Mirror Preview", "toggleMirror:");
  mirror.state = options.mirror ? 1 : 0;
  menu.addItem(mirror);
  menu.addItem($.NSMenuItem.separatorItem);
  menu.addItem(item("Show Last Photo in Finder", "reveal:"));
  menu.addItem(item("Open Photos Folder", "openFolder:"));
  menu.addItem($.NSMenuItem.separatorItem);
  menu.addItem(item("Close", "close:", "\u001b", 0));
  // JXA can't pass "no item" here (null arrives as an object macOS rejects): anchor the first item.
  menu.popUpMenuPositioningItemAtLocationInView(
    menu.itemAtIndex(0),
    $.NSMakePoint(footerView.frame.size.width - 190, FOOTER - 4),
    footerView,
  );
};

ObjC.registerSubclass({
  name: "IzskPreviewTarget",
  superclass: "NSObject",
  protocols: ["AVCapturePhotoCaptureDelegate"],
  methods: {
    "capture:": { types: ["void", ["id"]], implementation: safe(() => capture()) },
    "menu:": { types: ["void", ["id"]], implementation: safe(() => showMenu()) },
    "close:": { types: ["void", ["id"]], implementation: () => $.NSApp.terminate(null) },
    "reveal:": { types: ["void", ["id"]], implementation: safe(() => reveal()) },
    "openFolder:": { types: ["void", ["id"]], implementation: safe(() => openFolder()) },
    "switchCamera:": {
      types: ["void", ["id"]],
      implementation: safe((sender) => switchTo(ObjC.unwrap(sender.representedObject))),
    },
    "toggleMirror:": {
      types: ["void", ["id"]],
      implementation: () => {
        options.mirror = !options.mirror;
        setMirror(previewLayer.connection, options.mirror);
      },
    },
    endFlash: { types: ["void", []], implementation: () => (flashView.hidden = true) },
    resetStatus: { types: ["void", []], implementation: () => (statusLabel.stringValue = "Camera") },
    "captureOutput:didFinishProcessingPhoto:error:": {
      types: ["void", ["id", "id", "id"]],
      implementation: safe((output, photo, error) => savePhoto(photo, error)),
    },
  },
});

const K = 40; // the K key, whatever the keyboard layout's letters
const isCommandK = (event) => (Number(event.modifierFlags) & COMMAND) !== 0 && Number(event.keyCode) === K;
/** Pops the menu once the key press is done, so it isn't swallowed by the event in progress. */
const openMenuSoon = () => target.performSelectorWithObjectAfterDelay("menu:", null, 0);

ObjC.registerSubclass({
  name: "IzskPreviewWindow",
  superclass: "NSWindow",
  methods: {
    canBecomeKeyWindow: { types: ["bool", []], implementation: () => true },
    // ↩ captures, Escape closes, ⌘K opens Actions. ⌘K can arrive either way, so both handle it.
    "keyDown:": {
      types: ["void", ["id"]],
      implementation: safe((event) => {
        const key = Number(event.keyCode);
        if (key === ESCAPE) $.NSApp.terminate(null);
        else if (key === RETURN || key === ENTER) capture();
        else if (isCommandK(event)) openMenuSoon();
      }),
    },
    "performKeyEquivalent:": {
      types: ["bool", ["id"]],
      implementation: (event) => {
        if (!isCommandK(event)) return false;
        openMenuSoon();
        return true;
      },
    },
    // Dragging anywhere but the footer buttons moves the preview.
    "mouseDown:": {
      types: ["void", ["id"]],
      implementation: (event) => previewWindow.performWindowDragWithEvent(event),
    },
  },
});

/** A frame in the centre or a corner of the screen you're using, below the menu bar. */
const frame = (width, height, corner) => {
  const s = $.NSScreen.mainScreen.visibleFrame;
  const x = corner.endsWith("left")
    ? s.origin.x + MARGIN
    : corner.endsWith("right")
      ? s.origin.x + s.size.width - width - MARGIN
      : s.origin.x + (s.size.width - width) / 2;
  // Cocoa y grows upwards: "top" is the high end.
  const y = corner.startsWith("top")
    ? s.origin.y + s.size.height - height - MARGIN
    : corner.startsWith("bottom")
      ? s.origin.y + MARGIN
      : s.origin.y + (s.size.height - height) / 2;
  return $.NSMakeRect(x, y, width, height);
};
/** A filled rounded rectangle from plain NSColors: setting CALayer colours (CGColor) from JXA crashes. */
const box = (rect, fill, radius = 0, border = null) => {
  const b = $.NSBox.alloc.initWithFrame(rect);
  b.boxType = 4; // custom
  b.titlePosition = 0; // no title
  b.contentViewMargins = $.NSMakeSize(0, 0);
  b.fillColor = fill;
  b.cornerRadius = radius;
  b.borderWidth = border ? 1 : 0;
  if (border) b.borderColor = border;
  return b;
};
const footerButton = (title, action) => {
  const b = $.NSButton.buttonWithTitleTargetAction(title, target, action);
  b.bordered = false;
  b.font = $.NSFont.systemFontOfSize(12);
  b.contentTintColor = $.NSColor.secondaryLabelColor;
  // Clicks only: keys (↩, ⌘K, esc) go to the window, and no focus ring appears.
  b.refusesFirstResponder = true;
  b.focusRingType = 1;
  b.sizeToFit;
  return b;
};

function run() {
  try {
    options = settings();
    target = $.IzskPreviewTarget.alloc.init;
    const device = cls("AVCaptureDevice").defaultDeviceWithMediaType("vide");
    if (device.isNil()) return $.NSApp.terminate(null);
    session = cls("AVCaptureSession").alloc.init;
    input = cls("AVCaptureDeviceInput").deviceInputWithDeviceError(device, null);
    if (input.isNil() || !session.canAddInput(input)) return $.NSApp.terminate(null);
    session.addInput(input);
    photoOutput = cls("AVCapturePhotoOutput").alloc.init;
    if (session.canAddOutput(photoOutput)) session.addOutput(photoOutput);

    const screen = $.NSScreen.mainScreen.visibleFrame;
    const w = Math.min(Number(options.width) || 880, screen.size.width - 2 * MARGIN);
    const videoHeight = Math.round((w * 9) / 16);
    previewWindow = $.IzskPreviewWindow.alloc.initWithContentRectStyleMaskBackingDefer(
      frame(w, videoHeight + FOOTER, String(options.corner || "centre")),
      0, // borderless: no title bar or buttons
      2,
      false,
    );
    previewWindow.level = 3; // floats above other windows
    // A clear window, so only the rounded shape (and its shadow) shows: no square corners.
    previewWindow.opaque = false;
    previewWindow.backgroundColor = $.NSColor.clearColor;
    previewWindow.hasShadow = true;
    previewWindow.releasedWhenClosed = false;
    previewWindow.appearance = $.NSAppearance.appearanceNamed("NSAppearanceNameDarkAqua");

    // The rounded shell: everything else sits inside it, so no square corners show.
    const shell = box(
      $.NSMakeRect(0, 0, w, videoHeight + FOOTER),
      $.NSColor.colorWithWhiteAlpha(0.1, 1),
      14,
      $.NSColor.colorWithWhiteAlpha(1, 0.14),
    );
    previewWindow.contentView = shell;
    const content = shell.contentView;

    const video = $.NSView.alloc.initWithFrame($.NSMakeRect(1, FOOTER, w - 2, videoHeight - 1));
    video.wantsLayer = true;
    video.layer.cornerRadius = 13;
    video.layer.cornerCurve = "continuous";
    video.layer.maskedCorners = 12; // top corners (layer y grows upwards)
    video.layer.masksToBounds = true;
    previewLayer = cls("AVCaptureVideoPreviewLayer").layerWithSession(session);
    previewLayer.videoGravity = "AVLayerVideoGravityResizeAspectFill";
    previewLayer.frame = video.bounds;
    video.layer.addSublayer(previewLayer);
    flashView = box(video.bounds, $.NSColor.colorWithWhiteAlpha(1, 0.85));
    flashView.hidden = true;
    video.addSubview(flashView);
    setMirror(previewLayer.connection, options.mirror !== false);
    options.mirror = options.mirror !== false;
    content.addSubview(video);

    footerView = $.NSView.alloc.initWithFrame($.NSMakeRect(0, 0, w, FOOTER));
    statusLabel = $.NSTextField.labelWithString("Camera");
    statusLabel.font = $.NSFont.systemFontOfSize(11);
    statusLabel.textColor = $.NSColor.secondaryLabelColor;
    statusLabel.sizeToFit;
    statusLabel.frame = $.NSMakeRect(14, (FOOTER - statusLabel.frame.size.height) / 2, w / 2, statusLabel.frame.size.height);
    footerView.addSubview(statusLabel);
    let x = w - 12;
    for (const [title, action] of [
      ["Close  ⎋", "close:"],
      ["Actions  ⌘K", "menu:"],
      ["Capture  ↩", "capture:"],
    ]) {
      const b = footerButton(title, action);
      const size = b.frame.size;
      x -= size.width;
      b.frame = $.NSMakeRect(x, (FOOTER - size.height) / 2, size.width, size.height);
      footerView.addSubview(b);
      x -= 16;
    }
    content.addSubview(footerView);

    previewWindow.makeKeyAndOrderFront(null);
    previewWindow.invalidateShadow;
    $.NSApp.activateIgnoringOtherApps(true);
    session.startRunning;
  } catch (error) {
    // Leave the reason next to preview.json, then quit instead of showing a script error dialog.
    const data = $.NSBundle.mainBundle.bundlePath.stringByDeletingLastPathComponent.stringByDeletingLastPathComponent;
    $(String(error)).writeToFileAtomicallyEncodingError(`${ObjC.unwrap(data)}/preview-error.txt`, true, 4, null);
    $.NSApp.terminate(null);
  }
}
// A stay-open applet needs an idle handler; nothing to do.
function idle() {
  return 30;
}
