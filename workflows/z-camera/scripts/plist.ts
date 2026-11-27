import pkg from "../package.json" with { type: "json" };
const object = (uid: string, type: string, config: object, version = 1) => ({ uid, type, version, config });
const link = (b: string) => ({ destinationuid: b, modifiers: 0, modifiersubtext: "", vitoclose: false });
const hotkey = (uid: string) =>
  object(
    uid,
    "alfred.workflow.trigger.hotkey",
    {
      hotkey: 0,
      hotmod: 0,
      action: 0,
      argument: 0,
      relatedAppsMode: 0,
      focusedappvariable: false,
      focusedappvariablename: "",
      leftcursor: false,
      modsmode: 0,
    },
    2,
  );
const command = (uid: string, value: string) =>
  object(uid, "alfred.workflow.utility.argument", {
    argument: value,
    passthroughargument: false,
    variables: {},
  });
const popup = (variable: string, label: string, description: string, value: string, pairs: string[][]) => ({
  type: "popupbutton",
  variable,
  label,
  description,
  config: { default: value, pairs },
});
// Every route ends in one script; what it prints (a saved photo, an error) becomes a notification.
export const infoPlist = {
  bundleid: "com.izsk.camera",
  name: "Camera",
  createdby: "izsk",
  category: "Tools",
  disabled: false,
  version: pkg.version,
  description: pkg.description,
  webaddress: "https://github.com/sk-izsk/z-alfred-workflow/tree/dev/workflows/z-camera",
  objects: [
    object(
      "KEYWORD",
      "alfred.workflow.input.scriptfilter",
      {
        keyword: "{var:kw_main}",
        title: "Camera",
        subtext: "Preview, photo and camera switch",
        runningsubtext: "…",
        script: "/usr/bin/osascript -l JavaScript ./bin/camera.js filter",
        scriptargtype: 1,
        type: 0,
        escaping: 0,
        scriptfile: "",
        withspace: true,
        argumenttype: 1,
        argumenttreatemptyqueryasnil: false,
        alfredfiltersresults: true,
        alfredfiltersresultsmatchmode: 2,
        queuemode: 1,
        queuedelaymode: 0,
        queuedelayimmediatelyinitially: true,
        skipuniversalaction: true,
      },
      3,
    ),
    // Set these in Alfred Preferences (double-click a Hotkey object).
    hotkey("PREVIEW_HOTKEY"),
    hotkey("PHOTO_HOTKEY"),
    object("TRIGGER", "alfred.workflow.trigger.external", { triggerid: "open", availableviaurlscheme: true }),
    command("TOGGLE", "toggle"),
    command("PHOTO", "photo"),
    object(
      "RUN",
      "alfred.workflow.action.script",
      {
        script: '/usr/bin/osascript -l JavaScript ./bin/camera.js "$1"',
        type: 0,
        scriptargtype: 1,
        escaping: 0,
        scriptfile: "",
        concurrently: false,
      },
      2,
    ),
    object("NOTIFY", "alfred.workflow.output.notification", {
      title: "Camera",
      text: "{query}",
      removeextension: false,
      onlyshowifquerypopulated: true,
      lastpathcomponent: false,
    }),
  ],
  connections: {
    KEYWORD: [link("RUN")],
    PREVIEW_HOTKEY: [link("TOGGLE")],
    TRIGGER: [link("TOGGLE")],
    PHOTO_HOTKEY: [link("PHOTO")],
    TOGGLE: [link("RUN")],
    PHOTO: [link("RUN")],
    RUN: [link("NOTIFY")],
  },
  uidata: Object.fromEntries(
    [
      ["KEYWORD", 0, 0],
      ["PREVIEW_HOTKEY", 0, 140],
      ["TRIGGER", 0, 280],
      ["PHOTO_HOTKEY", 0, 420],
      ["TOGGLE", 200, 200],
      ["PHOTO", 200, 440],
      ["RUN", 380, 140],
      ["NOTIFY", 560, 140],
    ].map(([id, x, y]) => [id, { xpos: x, ypos: y }]),
  ),
  userconfigurationconfig: [
    {
      type: "textfield",
      variable: "kw_main",
      label: "Keyword",
      description: "Lists Show/Hide Preview, Take Photo and Switch Camera.",
      config: { default: "cam", placeholder: "cam", required: true },
    },
    popup("camera_size", "Size", "How big the preview is (photos are this size too).", "medium", [
      ["Small", "small"],
      ["Medium", "medium"],
      ["Large", "large"],
    ]),
    popup("camera_corner", "Position", "Where the preview appears on the main display.", "centre", [
      ["Centre", "centre"],
      ["Top right", "top-right"],
      ["Top left", "top-left"],
      ["Bottom right", "bottom-right"],
      ["Bottom left", "bottom-left"],
    ]),
    {
      type: "textfield",
      variable: "photo_folder",
      label: "Photos folder",
      description: "Where Take Photo saves pictures.",
      config: { default: "~/Pictures/Camera", placeholder: "~/Pictures/Camera", required: false, trim: true },
    },
  ],
  variablesdontexport: [],
  readme:
    "A quick camera check before a meeting. Type cam for Show/Hide Preview, Take Photo and Switch Camera (with more than one camera). The preview is small, muted and never records; photos save what it shows. Set hotkeys for the preview and for a photo by double-clicking the Hotkey objects. QuickTime Player shows the camera, because Alfred itself can't use it. Built with help from AI tools.",
};
