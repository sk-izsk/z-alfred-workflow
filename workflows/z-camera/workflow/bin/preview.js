// Camera Preview: a small app that only shows the camera, mirrored, with no controls.
// The workflow builds it with osacompile on this Mac (bin/camera), so it has its own camera
// permission: Alfred can't use the camera itself. A click or any key closes it.
// Size and position come from preview.json in the workflow's data folder:
// {"width": 880, "corner": "centre"}.
ObjC.import("AppKit");
$.NSBundle.bundleWithPath("/System/Library/Frameworks/AVFoundation.framework").load;
const cls = (name) => $.NSClassFromString(name);
const MARGIN = 20;
var session, previewWindow; // kept alive while the app runs

ObjC.registerSubclass({
  name: "IzskPreviewWindow",
  superclass: "NSWindow",
  methods: {
    canBecomeKeyWindow: { types: ["bool", []], implementation: () => true },
    "keyDown:": { types: ["void", ["id"]], implementation: () => $.NSApp.terminate(null) },
    "mouseDown:": { types: ["void", ["id"]], implementation: () => $.NSApp.terminate(null) },
  },
});

/** preview.json sits two folders up: <data>/v-<hash>/Camera Preview.app */
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

function run() {
  try {
    const device = cls("AVCaptureDevice").defaultDeviceWithMediaType("vide");
    if (device.isNil()) return $.NSApp.terminate(null);
    session = cls("AVCaptureSession").alloc.init;
    const input = cls("AVCaptureDeviceInput").deviceInputWithDeviceError(device, null);
    if (input.isNil() || !session.canAddInput(input)) return $.NSApp.terminate(null);
    session.addInput(input);

    const { width = 880, corner = "centre" } = settings();
    const screen = $.NSScreen.mainScreen.visibleFrame;
    const w = Math.min(Number(width) || 880, screen.size.width - 2 * MARGIN);
    const h = Math.round((w * 9) / 16);
    previewWindow = $.IzskPreviewWindow.alloc.initWithContentRectStyleMaskBackingDefer(
      frame(w, h, String(corner)),
      0, // borderless: no title bar, no buttons
      2,
      false,
    );
    previewWindow.level = 3; // floats above other windows
    previewWindow.backgroundColor = $.NSColor.blackColor;
    previewWindow.hasShadow = true;
    previewWindow.releasedWhenClosed = false;

    const view = previewWindow.contentView;
    view.wantsLayer = true;
    view.layer.cornerRadius = 14;
    view.layer.masksToBounds = true;
    const layer = cls("AVCaptureVideoPreviewLayer").layerWithSession(session);
    layer.videoGravity = "AVLayerVideoGravityResizeAspectFill";
    layer.frame = view.bounds;
    layer.autoresizingMask = 18; // width and height follow the window
    const connection = layer.connection;
    if (!connection.isNil() && connection.isVideoMirroringSupported) {
      // Mirrored, like a mirror (and like FaceTime's own preview).
      connection.automaticallyAdjustsVideoMirroring = false;
      connection.videoMirrored = true;
    }
    view.layer.addSublayer(layer);
    previewWindow.makeKeyAndOrderFront(null);
    $.NSApp.activateIgnoringOtherApps(true);
    session.startRunning;
  } catch {
    $.NSApp.terminate(null);
  }
}
// A stay-open applet needs an idle handler; nothing to do.
function idle() {
  return 30;
}
