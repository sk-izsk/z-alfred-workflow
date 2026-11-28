import pkg from "../package.json" with { type: "json" };
const object = (uid: string, type: string, config: object, version = 1) => ({ uid, type, version, config });
const link = (b: string) => ({ destinationuid: b, modifiers: 0, modifiersubtext: "", vitoclose: false });
const popup = (variable: string, label: string, description: string, value: string, pairs: string[][]) => ({
  type: "popupbutton",
  variable,
  label,
  description,
  config: { default: value, pairs },
});
// Keyword, hotkey and Swiss's External Trigger all run one toggle; a problem becomes a notification.
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
    object("KEYWORD", "alfred.workflow.input.keyword", {
      keyword: "{var:kw_main}",
      text: "Camera",
      subtext: "Show or hide a camera preview",
      argumenttype: 2,
      withspace: false,
    }),
    // Set the hotkey in Alfred Preferences (double-click the Hotkey object).
    object(
      "HOTKEY",
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
    ),
    object("TRIGGER", "alfred.workflow.trigger.external", { triggerid: "open", availableviaurlscheme: true }),
    object(
      "RUN",
      "alfred.workflow.action.script",
      { script: "./bin/camera", type: 0, scriptargtype: 1, escaping: 0, scriptfile: "", concurrently: false },
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
    HOTKEY: [link("RUN")],
    TRIGGER: [link("RUN")],
    RUN: [link("NOTIFY")],
  },
  uidata: Object.fromEntries(
    [
      ["KEYWORD", 0, 0],
      ["HOTKEY", 0, 140],
      ["TRIGGER", 0, 280],
      ["RUN", 220, 140],
      ["NOTIFY", 420, 140],
    ].map(([id, x, y]) => [id, { xpos: x, ypos: y }]),
  ),
  userconfigurationconfig: [
    {
      type: "textfield",
      variable: "kw_main",
      label: "Keyword",
      description: "Shows the preview; Escape (or running it again) hides it.",
      config: { default: "cam", placeholder: "cam", required: true },
    },
    popup("camera_size", "Size", "How big the preview is.", "medium", [
      ["Small", "small"],
      ["Medium", "medium"],
      ["Large", "large"],
    ]),
    popup("camera_corner", "Position", "Where the preview appears on the screen you're using.", "centre", [
      ["Centre", "centre"],
      ["Top right", "top-right"],
      ["Top left", "top-left"],
      ["Bottom right", "bottom-right"],
      ["Bottom left", "bottom-left"],
    ]),
  ],
  variablesdontexport: [],
  readme:
    "A quick camera check before a meeting. Type cam (or use the hotkey) to show a mirrored live preview of your camera, with no controls; drag it to move it; Escape (or cam again) hides it. The first time, macOS asks to let Camera Preview use the camera. Built with help from AI tools.",
};
