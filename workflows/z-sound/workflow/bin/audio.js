// Sound devices through CoreAudio, from JXA (no compiled helper to sign or install).
//   osascript -l JavaScript audio.js list                → JSON: devices plus current output/input/alert
//   osascript -l JavaScript audio.js set <kind> <uid>   → makes the device the default output, input or alert device
// CoreAudio's BridgeSupport struct arguments crash JXA, so the functions are bound with `void *`
// arguments and every struct/buffer is malloc'd memory filled and read through NSData.
ObjC.import("Foundation");
$.NSBundle.bundleWithPath("/System/Library/Frameworks/CoreAudio.framework").load;
ObjC.bindFunction("malloc", ["void *", ["int"]]);
ObjC.bindFunction("free", ["void", ["void *"]]);
ObjC.bindFunction("AudioObjectGetPropertyDataSize", ["int", ["unsigned int", "void *", "unsigned int", "void *", "void *"]]);
ObjC.bindFunction("AudioObjectSetPropertyData", ["int", ["unsigned int", "void *", "unsigned int", "void *", "unsigned int", "void *"]]);

const SYSTEM = 1;
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const toB64 = (bytes) => {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? B64[n & 63] : "=";
  }
  return out;
};
const fromB64 = (text) => {
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
const code = (s) => [...s].reduce((a, c) => a * 256 + c.charCodeAt(0), 0) >>> 0;
const u32 = (values) => values.flatMap((v) => [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]);
const r32 = (b, i = 0) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const f32 = (b) => new DataView(new Uint8Array(b.slice(0, 4)).buffer).getFloat32(0, true);
const memory = (bytes) => {
  const p = $.malloc(Math.max(bytes.length, 1));
  $.NSData.alloc.initWithBase64EncodedStringOptions(toB64(bytes), 0).getBytesLength(p, bytes.length);
  return p;
};
const read = (p, n) => fromB64(ObjC.unwrap($.NSData.dataWithBytesLength(p, n).base64EncodedStringWithOptions(0)));
const address = (selector, scope, element) => memory(u32([code(selector), code(scope), element]));

/** Raw bytes of a property, or null when the object doesn't have it. */
const bytes = (object, selector, scope = "glob", element = 0) => {
  ObjC.bindFunction("AudioObjectGetPropertyData", ["int", ["unsigned int", "void *", "unsigned int", "void *", "void *", "void *"]]);
  const a = address(selector, scope, element),
    n = memory([0, 0, 0, 0]);
  try {
    if ($.AudioObjectGetPropertyDataSize(object, a, 0, null, n) !== 0) return null;
    const size = r32(read(n, 4));
    const d = $.malloc(Math.max(size, 1));
    try {
      return $.AudioObjectGetPropertyData(object, a, 0, null, n, d) === 0 ? read(d, size) : null;
    } finally {
      $.free(d);
    }
  } finally {
    $.free(a);
    $.free(n);
  }
};
/** A CFString property (name, UID), returned as an object reference. */
const text = (object, selector) => {
  ObjC.bindFunction("AudioObjectGetPropertyData", ["int", ["unsigned int", "void *", "unsigned int", "void *", "void *", "id *"]]);
  const a = address(selector, "glob", 0),
    n = memory(u32([8])),
    out = Ref();
  try {
    return $.AudioObjectGetPropertyData(object, a, 0, null, n, out) === 0 ? ObjC.unwrap(out[0]) || "" : "";
  } finally {
    $.free(a);
    $.free(n);
  }
};
const number = (object, selector, scope, element = 0) => {
  const b = bytes(object, selector, scope, element);
  return b ? r32(b) : null;
};
/** 0–1 volume: the main element, else the first channel (most built-in and USB devices). */
const volume = (id, scope) => {
  for (const element of [0, 1]) {
    const b = bytes(id, "volm", scope, element);
    if (b) return Math.round(f32(b) * 100) / 100;
  }
  return null;
};
const streams = (id, scope) => (bytes(id, "stm#", scope) || []).length / 4;
const TRANSPORT = {
  bltn: "built-in",
  usb: "usb",
  blue: "bluetooth",
  blea: "bluetooth",
  hdmi: "hdmi",
  dprt: "displayport",
  airp: "airplay",
  virt: "virtual",
  grup: "aggregate",
  aggr: "aggregate",
  thun: "thunderbolt",
  fwre: "firewire",
  pci: "pci",
};
const transport = (id) => {
  const n = number(id, "tran", "glob");
  if (!n) return "unknown";
  const raw = String.fromCharCode((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255).trim();
  return TRANSPORT[raw] || raw;
};

const list = () => {
  const ids = bytes(SYSTEM, "dev#") || [];
  const devices = [];
  for (let i = 0; i < ids.length; i += 4) {
    const id = r32(ids, i);
    const outputs = streams(id, "outp"),
      inputs = streams(id, "inpt");
    const name = text(id, "lnam");
    // Hidden helper devices macOS creates for apps (e.g. CADefaultDeviceAggregate) aren't choices.
    if ((!outputs && !inputs) || name.startsWith("CADefaultDeviceAggregate")) continue;
    const muted = bytes(id, "mute", outputs ? "outp" : "inpt", 0);
    devices.push({
      id,
      uid: text(id, "uid "),
      name,
      transport: transport(id),
      outputs,
      inputs,
      outputVolume: outputs ? volume(id, "outp") : null,
      inputVolume: inputs ? volume(id, "inpt") : null,
      muted: muted ? r32(muted) === 1 : false,
    });
  }
  return {
    output: number(SYSTEM, "dOut", "glob"),
    input: number(SYSTEM, "dIn ", "glob"),
    alert: number(SYSTEM, "sOut", "glob"),
    devices,
  };
};

const SELECTOR = { output: "dOut", input: "dIn ", alert: "sOut" };
const setDefault = (kind, uid) => {
  const selector = SELECTOR[kind];
  if (!selector) throw new Error(`Unknown kind ${kind}`);
  const device = list().devices.find((d) => d.uid === uid);
  if (!device) throw new Error("That device is no longer connected.");
  if ((kind === "input" ? device.inputs : device.outputs) === 0)
    throw new Error(`${device.name} has no ${kind === "input" ? "input" : "output"}.`);
  const a = address(selector, "glob", 0),
    d = memory(u32([device.id]));
  try {
    const status = $.AudioObjectSetPropertyData(SYSTEM, a, 0, null, 4, d);
    if (status !== 0) throw new Error(`macOS refused to switch to ${device.name} (${status}).`);
  } finally {
    $.free(a);
    $.free(d);
  }
  return { ok: true, name: device.name };
};

function run(argv) {
  try {
    const [command, kind, uid] = argv;
    return JSON.stringify(command === "set" ? setDefault(kind, uid) : list());
  } catch (error) {
    return JSON.stringify({ error: String(error && error.message ? error.message : error) });
  }
}
