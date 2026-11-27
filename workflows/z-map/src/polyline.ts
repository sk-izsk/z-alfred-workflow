import type { LngLat } from "./model.ts";

// Arithmetic instead of bitwise ops: deltas at precision 7 overflow 32-bit integers.
const readVarint = (codes: number[], at: { i: number }): number => {
  let result = 0;
  let factor = 1;
  for (;;) {
    const value = codes[at.i++];
    if (value === undefined) throw new Error("Truncated polyline");
    result += (value & 0x1f) * factor;
    if (!(value & 0x20)) return result;
    factor *= 32;
  }
};
const signed = (n: number): number => (n % 2 ? -(n + 1) / 2 : n / 2);

/** Google encoded polyline (Transitous uses precision 6). */
export const decodePolyline = (text: string, precision = 5): LngLat[] => {
  const codes = [...text].map((c) => c.charCodeAt(0) - 63);
  const at = { i: 0 };
  const scale = 10 ** precision;
  const out: LngLat[] = [];
  let lat = 0;
  let lon = 0;
  while (at.i < codes.length) {
    lat += signed(readVarint(codes, at));
    lon += signed(readVarint(codes, at));
    out.push([lon / scale, lat / scale]);
  }
  return out;
};

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** HERE flexible polyline (github.com/heremaps/flexible-polyline); the third dimension is dropped. */
export const decodeFlexible = (text: string): LngLat[] => {
  const codes = [...text].map((c) => {
    const value = ALPHABET.indexOf(c);
    if (value < 0) throw new Error("Invalid flexible polyline");
    return value;
  });
  const at = { i: 0 };
  if (readVarint(codes, at) !== 1) throw new Error("Unsupported flexible polyline version");
  const header = readVarint(codes, at);
  const scale = 10 ** (header & 15);
  const third = (header >> 4) & 7;
  const out: LngLat[] = [];
  let lat = 0;
  let lon = 0;
  while (at.i < codes.length) {
    lat += signed(readVarint(codes, at));
    lon += signed(readVarint(codes, at));
    if (third) readVarint(codes, at);
    out.push([lon / scale, lat / scale]);
  }
  return out;
};
