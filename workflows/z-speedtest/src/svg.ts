import { str } from "./env.ts";
const isDark = str("alfred_theme_background", "rgba(255,255,255,1)").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
const dark =
  str("appearance", "automatic") === "dark" ||
  (str("appearance", "automatic") !== "light" &&
    !!isDark &&
    Number(isDark[1]) + Number(isDark[2]) + Number(isDark[3]) < 384);
export const theme = {
  isDark: dark,
  text: dark ? "#ffffff" : "#1a1a1a",
  muted: dark ? "#a1a1a1" : "#767676",
  faint: dark ? "#3a3a3a" : "#ececec",
  card: dark ? "#242424" : "#f4f4f4",
  track: dark ? "#333333" : "#e4e4e4",
  download: "#0A7FF5",
  upload: dark ? "#7B4EF8" : "#470AF5",
  ping: "#E0A200",
  good: "#07BA65",
  bad: "#F50A0A",
};
export const FONT = 'font-family="-apple-system, Helvetica, sans-serif"';
export const svg = (w: number, h: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
export const xml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
