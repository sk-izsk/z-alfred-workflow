import { deflateSync } from "node:zlib";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cacheDir } from "./env.ts";
const table = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
const crc = (data: Buffer): number => {
  let n = 0xffffffff;
  for (const b of data) n = table[(n ^ b) & 255]! ^ (n >>> 8);
  return (n ^ 0xffffffff) >>> 0;
};
const chunk = (name: string, data: Buffer): Buffer => {
  const type = Buffer.from(name),
    size = Buffer.alloc(4),
    check = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  check.writeUInt32BE(crc(Buffer.concat([type, data])));
  return Buffer.concat([size, type, data, check]);
};
const segmentDistance = (x: number, y: number, ex: number, ey: number): number => {
  const t = Math.max(0, Math.min(1, (x * ex + y * ey) / (ex * ex + ey * ey)));
  return Math.hypot(x - t * ex, y - t * ey);
};
const end = (angle: number, length: number) => [Math.sin(angle) * length, -Math.cos(angle) * length];
// Small transparent analog icons; no browser, drawing dependency, network, or runtime compiler.
export const clockPNG = (hour: number, minute: number): Buffer => {
  const size = 128,
    center = 64,
    radius = 55,
    raw = Buffer.alloc((size * 4 + 1) * size);
  const [hx, hy] = end((((hour % 12) + minute / 60) / 12) * Math.PI * 2, 31),
    [mx, my] = end((minute / 60) * Math.PI * 2, 44);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - center,
        dy = y + 0.5 - center,
        ring = Math.abs(Math.hypot(dx, dy) - radius),
        hourDistance = segmentDistance(dx, dy, hx!, hy!),
        minuteDistance = segmentDistance(dx, dy, mx!, my!);
      let colour = [128, 128, 128],
        coverage = Math.max(0, Math.min(1, 2.3 - ring));
      if (hourDistance < 3.5) {
        colour = [255, 164, 30];
        coverage = Math.max(0, Math.min(1, 3.5 - hourDistance));
      }
      if (minuteDistance < 2.8) {
        colour = [43, 180, 210];
        coverage = Math.max(0, Math.min(1, 2.8 - minuteDistance));
      }
      if (Math.hypot(dx, dy) < 4) {
        colour = [43, 180, 210];
        coverage = 1;
      }
      const at = y * (size * 4 + 1) + 1 + x * 4;
      raw[at] = colour[0]!;
      raw[at + 1] = colour[1]!;
      raw[at + 2] = colour[2]!;
      raw[at + 3] = Math.round(255 * coverage);
    }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};
export const face = (hour: number, minute: number): string => {
  const path = join(cacheDir(), `face-v1-${hour % 12}-${minute}.png`);
  if (!existsSync(path)) writeFileSync(path, clockPNG(hour, minute), { mode: 0o600 });
  return path;
};
