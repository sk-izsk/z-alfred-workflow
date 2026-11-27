// A quick camera check: QuickTime Player shows a small, muted live preview (it never records).
//   osascript -l JavaScript camera.js filter          → Alfred Script Filter JSON (the `cam` list)
//   osascript -l JavaScript camera.js toggle|photo|next|folder
// Settings come from the workflow's environment (camera_size, camera_corner, photo_folder).
// QuickTime does the camera work because Alfred itself has no camera permission
// (no NSCameraUsageDescription), so nothing Alfred runs can open the camera directly.
ObjC.import("AppKit");
ObjC.import("Foundation");
ObjC.import("CoreGraphics");

const WIDTHS = { small: 360, medium: 520, large: 760 };
const MARGIN = 20;
const TITLE_BAR = 28;
const env = (name, fallback = "") => {
  const value = $.NSProcessInfo.processInfo.environment.objectForKey(name);
  return value && !value.isNil() ? ObjC.unwrap(value) || fallback : fallback;
};
const HOME = ObjC.unwrap($.NSHomeDirectory());
const expand = (path) => path.replace(/^~(?=\/|$)/, HOME);
const photoFolder = () => expand(env("photo_folder", "~/Pictures/Camera"));
const cacheDir = () => env("alfred_workflow_cache");
const fm = $.NSFileManager.defaultManager;
const mkdir = (dir) => fm.createDirectoryAtPathWithIntermediateDirectoriesAttributesError(dir, true, $(), null);

const stateFile = () => (cacheDir() ? `${cacheDir()}/camera.json` : "");
const readState = () => {
  try {
    return JSON.parse(ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(stateFile(), 4, null)));
  } catch {
    return {};
  }
};
const writeState = (patch) => {
  if (!cacheDir()) return;
  mkdir(cacheDir());
  $(JSON.stringify({ ...readState(), ...patch })).writeToFileAtomicallyEncodingError(stateFile(), true, 4, null);
};

const qt = () => Application("com.apple.QuickTimePlayerX");
// A recording preview has no file; in English macOS it is called "Movie Recording".
const isPreview = (doc) => {
  try {
    return doc.file() === null && /Recording/i.test(doc.name());
  } catch {
    return false;
  }
};
/** The open preview, or null. Never launches QuickTime. */
const preview = () => {
  const app = qt();
  if (!app.running()) return null;
  return app.documents().find(isPreview) || null;
};
/** QuickTime can count cameras but (on current macOS) not name them. */
const cameraCount = () => {
  try {
    return qt().videoRecordingDevices.length;
  } catch {
    return 0;
  }
};

/**
 * Window bounds in the centre or a corner of the main screen's usable area. `ratio` is the camera's
 * height/width: QuickTime's title bar floats over the video, so the window is exactly the image.
 */
const placement = (size, corner, ratio) => {
  const width = WIDTHS[size] || WIDTHS.medium;
  const height = Math.round(width * ratio);
  const screen = $.NSScreen.mainScreen;
  const full = screen.frame,
    visible = screen.visibleFrame;
  // Cocoa frames start bottom-left; window bounds start top-left of the main screen.
  const left = visible.origin.x,
    top = full.size.height - (visible.origin.y + visible.size.height);
  const right = left + visible.size.width,
    bottom = top + visible.size.height;
  const x = corner.endsWith("left")
    ? left + MARGIN
    : corner === "centre"
      ? Math.round((left + right - width) / 2)
      : right - width - MARGIN;
  const y = corner.startsWith("bottom")
    ? bottom - height - MARGIN
    : corner === "centre"
      ? Math.round((top + bottom - height) / 2)
      : top + MARGIN;
  return { x, y, width, height };
};

const open = () => {
  const app = qt();
  writeState({ qtWasRunning: app.running() });
  const doc = app.newMovieRecording();
  try {
    doc.muted = true; // never play the microphone back
  } catch {}
  const index = readState().cameraIndex || 0;
  if (index > 0 && index < cameraCount()) {
    try {
      doc.currentCamera = app.videoRecordingDevices[index];
    } catch {}
  }
  // QuickTime sizes the window to the camera once the feed starts: read that shape, then place it.
  let natural = { width: 0, height: 0 };
  for (let i = 0; i < 15 && natural.width < 640; i++) {
    delay(0.1);
    natural = app.windows[0].bounds();
  }
  const ratio = natural.width && natural.height / natural.width > 0.3 && natural.height / natural.width < 1.2
    ? natural.height / natural.width
    : 9 / 16;
  const bounds = placement(env("camera_size", "medium"), env("camera_corner", "centre"), ratio);
  for (let i = 0; i < 10; i++) {
    delay(0.15);
    app.windows[0].bounds = bounds;
    if (i >= 3 && Math.abs(app.windows[0].bounds().width - bounds.width) < 4) break;
  }
  app.activate();
  return doc;
};
const close = (doc) => {
  const app = qt();
  doc.close({ saving: "no" });
  // Quit QuickTime again if the preview started it and nothing else is open.
  if (readState().qtWasRunning === false && app.documents().length === 0) app.quit();
};

/** The preview's on-screen window (CoreGraphics id and frame), for the photo. */
const previewWindow = () => {
  const list = ObjC.deepUnwrap(ObjC.castRefToObject($.CGWindowListCopyWindowInfo(1 | 16, 0))) || [];
  return list.find(
    (w) => w.kCGWindowOwnerName === "QuickTime Player" && w.kCGWindowLayer === 0 && /Recording/i.test(w.kCGWindowName || ""),
  );
};
const stamp = () => {
  const f = $.NSDateFormatter.alloc.init;
  f.dateFormat = "yyyy-MM-dd 'at' HH.mm.ss";
  return ObjC.unwrap(f.stringFromDate($.NSDate.date));
};
const shell = (command) => app().doShellScript(command);
const app = () => {
  const a = Application.currentApplication();
  a.includeStandardAdditions = true;
  return a;
};
const quote = (s) => `'${s.replaceAll("'", `'\\''`)}'`;

/** Saves what the preview shows, without the title bar, as a PNG. Opens the preview first if needed. */
const photo = () => {
  if (!preview()) {
    open();
    delay(1.5); // let the camera adjust its exposure
  }
  qt().activate();
  delay(0.2);
  const w = previewWindow();
  if (!w) throw new Error("The preview window isn't on screen.");
  const folder = photoFolder();
  mkdir(folder);
  const file = `${folder}/Camera ${stamp()}.png`;
  // The screen area below the title bar: just the camera image, at the screen's full resolution.
  const b = w.kCGWindowBounds;
  const region = [b.X, b.Y + TITLE_BAR, b.Width, b.Height - TITLE_BAR].map(Math.round).join(",");
  shell(`/usr/sbin/screencapture -x -R${region} ${quote(file)}`);
  return `Saved ${file.split("/").pop()}`;
};

const next = () => {
  const count = cameraCount();
  if (count < 2) return "Only one camera is connected.";
  const index = ((readState().cameraIndex || 0) + 1) % count;
  writeState({ cameraIndex: index });
  const doc = preview();
  if (doc) doc.currentCamera = qt().videoRecordingDevices[index];
  else open();
  return `Camera ${index + 1} of ${count}`;
};

const item = (title, subtitle, arg, icon, valid = true) => ({
  title,
  subtitle,
  arg,
  valid,
  icon: { path: `icons/${icon}.png` },
});
/** The `cam` list. Show/Hide first, so `cam` ↩ toggles straight away. */
const filter = () => {
  const open = Boolean(preview());
  const count = open ? cameraCount() : 0;
  const items = [
    open
      ? item("Hide Preview", "Close the camera preview", "toggle", "hide")
      : item("Show Preview", "A small, muted live preview in a corner (it never records)", "toggle", "show"),
    item("Take Photo", `Save what the preview shows to ${photoFolder().replace(HOME, "~")}`, "photo", "photo"),
  ];
  if (count > 1) items.push(item("Switch Camera", `Use the next of ${count} cameras`, "next", "switch"));
  items.push(item("Open Photos Folder", photoFolder().replace(HOME, "~"), "folder", "folder"));
  return { items };
};

function run(argv) {
  const [command = "toggle"] = argv;
  try {
    if (command === "filter") return JSON.stringify(filter());
    if (command === "photo") return photo();
    if (command === "next") return next();
    if (command === "folder") {
      mkdir(photoFolder());
      app().doShellScript(`/usr/bin/open ${quote(photoFolder())}`);
      return "";
    }
    const doc = preview();
    if (doc) close(doc);
    else open();
    return "";
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    return command === "filter" ? JSON.stringify({ items: [item(message, "Camera", "", "show", false)] }) : message;
  }
}
