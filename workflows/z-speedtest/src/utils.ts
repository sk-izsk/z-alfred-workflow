export const convertBitsToMbps = (speed = 0): number => (speed * 8) / 1_000_000;
export const pingToString = (ping: number | undefined): string =>
  ping === undefined || ping === 0 ? "?" : `${ping.toFixed(1)} ms`;
export const speedToString = (speed: number | undefined): string => {
  if (!speed) return "?";
  let bits = speed * 8;
  const units = ["", "K", "M", "G", "T"];
  const places = [0, 1, 2, 3, 3];
  let unit = 0;
  while (bits >= 2000 && unit < 4) {
    unit++;
    bits /= 1000;
  }
  return `${bits.toFixed(places[unit])} ${units[unit]}bps`;
};
export const qualities = (download: number, upload: number, activity: string): string[] => {
  const thresholds: Record<string, [string, number][]> = {
    voice: [
      ["SD", 0.05],
      ["HD", 0.1],
    ],
    video: [
      ["480", 1],
      ["720", 3],
      ["1080", 5],
      ["4K", 20],
    ],
    stream: [
      ["480", 1.5],
      ["720", 5],
      ["1080", 10],
      ["4K", 25],
    ],
  };
  return (thresholds[activity] ?? [])
    .filter(([, min]) => convertBitsToMbps(download) > min && convertBitsToMbps(upload) > min)
    .map(([label]) => label);
};
