// Mounted drives (bin/volumes.js), the disk images behind them (hdiutil) and ejecting (diskutil).
import { execFile } from "node:child_process";
import { statfs } from "node:fs/promises";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
/** bin/volumes.js sits next to the bundled bin/drives.mjs. */
const HELPER = fileURLToPath(new URL("./volumes.js", import.meta.url));

export type Volume = {
  path: string;
  name: string;
  total: number;
  free: number;
  ejectable: boolean;
  removable: boolean;
  internal: boolean;
  local: boolean;
  root: boolean;
  readOnly: boolean;
  format: string;
};
export type Kind = "startup" | "internal" | "external" | "image" | "network";
export type Drive = Volume & { kind: Kind; image?: string };

const run = async (file: string, args: string[], timeout = 15_000) =>
  (await execFileP(file, args, { encoding: "utf8", timeout, maxBuffer: 8e6 })).stdout;

/** Mount point → the .dmg (or other image) behind it. macOS's own images in /System are left out. */
export const parseImages = (json: string): Map<string, string> => {
  const map = new Map<string, string>();
  const info = JSON.parse(json) as {
    images?: { "image-path"?: string; "system-entities"?: { "mount-point"?: string }[] }[];
  };
  for (const image of info.images ?? []) {
    const file = image["image-path"];
    if (!file || file.startsWith("/System/")) continue;
    for (const entity of image["system-entities"] ?? [])
      if (entity["mount-point"]) map.set(entity["mount-point"], file);
  }
  return map;
};
const diskImages = async (): Promise<Map<string, string>> => {
  try {
    const plist = await run("/usr/bin/hdiutil", ["info", "-plist"], 5000);
    const json = await new Promise<string>((resolve, reject) => {
      const child = execFile("/usr/bin/plutil", ["-convert", "json", "-o", "-", "-"], (error, out) =>
        error ? reject(error) : resolve(out),
      );
      child.stdin?.end(plist);
    });
    return parseImages(json);
  } catch {
    // hdiutil unavailable or slow: images are still listed as drives, without their file
    return new Map();
  }
};

export const kindOf = (v: Volume, image?: string): Kind =>
  image ? "image" : v.root ? "startup" : !v.local ? "network" : v.internal ? "internal" : "external";

/**
 * Every visible mounted volume plus every opened disk image, even one mounted somewhere hidden
 * (images attached with -nobrowse or outside /Volumes).
 */
export const readDrives = async (): Promise<Drive[]> => {
  const [raw, images] = await Promise.all([
    run("/usr/bin/osascript", ["-l", "JavaScript", HELPER], 5000),
    diskImages(),
  ]);
  const volumes = JSON.parse(raw);
  if (volumes?.error) throw new Error(volumes.error);
  const drives: Drive[] = (volumes as Volume[]).map((v) => ({
    ...v,
    image: images.get(v.path),
    kind: kindOf(v, images.get(v.path)),
  }));
  const seen = new Set(drives.map((d) => d.path));
  for (const [path, image] of images) {
    if (seen.has(path)) continue;
    // Hidden mounts are skipped by the volume list; read their size from the file system.
    const fs = await statfs(path).catch(() => undefined);
    drives.push({
      path,
      name: basename(path),
      total: fs ? fs.blocks * fs.bsize : 0,
      free: fs ? fs.bavail * fs.bsize : 0,
      ejectable: true,
      removable: true,
      internal: false,
      local: true,
      root: false,
      readOnly: false,
      format: "",
      image,
      kind: "image",
    });
  }
  return drives;
};

/** Drives that can be ejected: everything but the startup disk and other internal volumes. */
export const canEject = (d: Drive): boolean => d.kind !== "startup" && d.kind !== "internal";

const ORDER: Record<Kind, number> = { startup: 0, internal: 1, external: 2, image: 3, network: 4 };
export const sortDrives = (list: Drive[]): Drive[] =>
  list.toSorted((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.name.localeCompare(b.name));

const LABEL: Record<Kind, string> = {
  startup: "Startup Disk",
  internal: "Internal",
  external: "External",
  image: "Disk Image",
  network: "Network",
};
/** Decimal units, like Finder: 967 GB, 4.8 MB. */
export const size = (bytes: number): string => {
  if (!bytes) return "0 KB";
  const units = ["bytes", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log10(bytes) / 3));
  const n = bytes / 1000 ** i;
  return `${n >= 100 || i === 0 ? Math.round(n) : n.toFixed(1)} ${units[i]}`;
};
/** Second line of a row: External · APFS · 967 GB free of 1 TB · Read-only · image.dmg */
export const describe = (d: Drive): string =>
  [
    LABEL[d.kind],
    d.format,
    d.total ? `${size(d.free)} free of ${size(d.total)}` : "",
    d.readOnly && "Read-only",
    d.image && basename(d.image),
  ]
    .filter(Boolean)
    .join(" · ");
export const symbol = (d: Drive): string =>
  ({
    startup: "internaldrive",
    internal: "internaldrive",
    external: d.removable ? "externaldrive" : "externaldrive.fill",
    image: "opticaldisc",
    network: "server.rack",
  })[d.kind];
/** 0–1 used, for the low-space colour. */
export const usedShare = (d: Drive): number => (d.total ? 1 - d.free / d.total : 0);

/** Every word of the query must appear in the name, kind, format or image file. */
export const matches = (d: Drive, query: string): boolean => {
  const text = `${d.name} ${describe(d)} ${d.path}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => text.includes(word));
};

/** The app or process macOS names when it refuses an eject (`dissented by PID 123 (/path)`). */
export const dissenter = (message: string): string | undefined => {
  const path = message.match(/dissented by PID \d+ \(([^)]+)\)/)?.[1];
  if (!path) return undefined;
  const app = path.match(/([^/]+)\.app\//)?.[1];
  return app || basename(path);
};

/**
 * Ejects a drive. Network shares are unmounted; disks and images are ejected (all their volumes,
 * as Finder does). `force` unmounts even when in use.
 */
export const eject = async (d: Drive, force = false): Promise<void> => {
  if (!canEject(d)) throw new Error(`${d.name} can't be ejected.`);
  const args =
    d.kind === "network"
      ? ["unmount", ...(force ? ["force"] : []), d.path]
      : force
        ? ["unmountDisk", "force", d.path]
        : ["eject", d.path];
  try {
    await run("/usr/sbin/diskutil", args, 60_000);
    // A forced unmount leaves the disk attached; eject it now that nothing holds it.
    if (force && d.kind !== "network")
      await run("/usr/sbin/diskutil", ["eject", d.path], 60_000).catch(() => {});
  } catch (error) {
    const text = `${(error as { stderr?: string }).stderr ?? ""}${(error as { stdout?: string }).stdout ?? ""}`;
    const who = dissenter(text);
    throw new Error(
      who
        ? `${d.name} is in use by ${who}. Quit it, or use Force Eject from Actions.`
        : `Couldn't eject ${d.name}${text.trim() ? `: ${text.trim().split("\n")[0]}` : "."}`,
      { cause: error },
    );
  }
};
