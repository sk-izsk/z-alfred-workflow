export const MODES = ["car", "transit", "bike", "walk"] as const;
export type Mode = (typeof MODES)[number];
export type LngLat = [number, number];

export type Place = { query: string; label: string; lat: number; lon: number };
export type Stop = {
  name: string;
  lat: number;
  lon: number;
  time?: number;
  track?: string;
  delay?: number;
};
export type Leg = {
  mode: string;
  transit: boolean;
  line?: string;
  color?: string;
  textColor?: string;
  headsign?: string;
  from: Stop;
  to: Stop;
  coords: LngLat[];
  stops?: number;
  distance?: number;
  duration: number;
};
export type Option = {
  duration: number;
  distance?: number;
  dep?: number;
  arr?: number;
  transfers?: number;
  legs: Leg[];
};
export type Routes = Partial<Record<Mode, Option[]>>;

export const isMode = (value: string): value is Mode => (MODES as readonly string[]).includes(value);
export const modeAt = (index: number): Mode => MODES[index] ?? "transit";

/** Joins per-segment options (A→B, B→C) into one option. */
export const chain = (parts: Option[]): Option | undefined => {
  if (!parts.length) return undefined;
  const legs = parts.flatMap((p) => p.legs);
  const dep = parts[0]?.dep;
  const arr = parts.at(-1)?.arr;
  return {
    legs,
    dep,
    arr,
    duration:
      dep !== undefined && arr !== undefined
        ? (arr - dep) / 1000
        : parts.reduce((sum, p) => sum + p.duration, 0),
    distance: parts.every((p) => p.distance !== undefined)
      ? parts.reduce((sum, p) => sum + (p.distance ?? 0), 0)
      : undefined,
    transfers: parts.reduce((sum, p) => sum + (p.transfers ?? 0), 0) + parts.length - 1,
  };
};
