import { randomBytes } from "node:crypto";
import { existsSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dashboardHTML } from "./presentation.ts";
import { type State } from "./model.ts";
import { sessionDir } from "./runner.ts";

// Keep the WebKit document alive. A local script delivers snapshots; no HTTP server or network
// requests are needed, and requestAnimationFrame interpolates between the CLI's slower samples.
export const meterClient = String.raw`
(() => {
  let active = document.body.dataset.running === "1", frame = 0, last = 0;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const gauges = [...document.querySelectorAll("[data-gauge]")].map(element => ({
    element, fraction: Number(element.dataset.fraction), bandwidth: Number(element.dataset.bandwidth),
    goalFraction: Number(element.dataset.fraction), goalBandwidth: Number(element.dataset.bandwidth)
  }));
  const speed = bandwidth => {
    if (!bandwidth) return ["—", "Mbps"];
    let bits = bandwidth * 8, unit = 0;
    while (bits >= 2000 && unit < 4) { unit++; bits /= 1000; }
    return [bits.toFixed([0,1,2,3,3][unit]), ["","K","M","G","T"][unit] + "bps"];
  };
  const paint = gauge => {
    const angle = (150 + 240 * gauge.fraction) * Math.PI / 180;
    const fill = gauge.element.querySelector("[data-gauge-fill]");
    fill.setAttribute("stroke-dasharray", gauge.fraction + " 1");
    fill.setAttribute("opacity", gauge.fraction > 0 ? "1" : "0");
    const knob = gauge.element.querySelector("[data-gauge-knob]");
    knob.setAttribute("cx", String(150 + Math.cos(angle) * 110));
    knob.setAttribute("cy", String(150 + Math.sin(angle) * 110));
    const [value, unit] = speed(gauge.bandwidth);
    gauge.element.querySelector("[data-gauge-value]").textContent = value;
    gauge.element.querySelector("[data-gauge-unit]").textContent = unit;
  };
  const animate = time => {
    const alpha = reduced.matches ? 1 : 1 - Math.exp(-Math.min(100, time - last) / 140);
    last = time;
    let moving = false;
    for (const gauge of gauges) {
      gauge.fraction += (gauge.goalFraction - gauge.fraction) * alpha;
      gauge.bandwidth += (gauge.goalBandwidth - gauge.bandwidth) * alpha;
      if (Math.abs(gauge.goalFraction - gauge.fraction) < 0.00005 &&
          Math.abs(gauge.goalBandwidth - gauge.bandwidth) < Math.max(1, gauge.goalBandwidth * 0.0001)) {
        gauge.fraction = gauge.goalFraction; gauge.bandwidth = gauge.goalBandwidth;
      } else moving = true;
      paint(gauge);
    }
    frame = moving ? requestAnimationFrame(animate) : 0;
  };
  window.speedtestUpdate = payload => {
    active = payload.running;
    const next = new DOMParser().parseFromString(payload.html, "text/html");
    if (!next.querySelector(".dashboard")) {
      cancelAnimationFrame(frame); frame = 0;
      document.body.innerHTML = next.body.innerHTML;
      return;
    }
    const incoming = [...next.querySelectorAll("[data-gauge]")];
    for (let i = 0; i < gauges.length; i++) {
      const gauge = gauges[i], source = incoming[i];
      gauge.goalFraction = Number(source.dataset.fraction);
      gauge.goalBandwidth = Number(source.dataset.bandwidth);
      gauge.element.querySelector("[data-gauge-status]").replaceWith(source.querySelector("[data-gauge-status]").cloneNode(true));
      gauge.element.querySelector("[data-gauge-progress]")?.remove();
      const progress = source.querySelector("[data-gauge-progress]");
      if (progress) gauge.element.append(progress.cloneNode(true));
    }
    const currentSvg = document.querySelector(".meters > svg"), nextSvg = next.querySelector(".meters > svg");
    [...currentSvg.children].filter(child => !child.querySelector("[data-gauge]")).forEach(child => child.remove());
    [...nextSvg.children].filter(child => !child.querySelector("[data-gauge]")).forEach(child => currentSvg.append(child.cloneNode(true)));
    const sidebar = document.querySelector(".sidebar"), scroll = sidebar.scrollTop;
    sidebar.innerHTML = next.querySelector(".sidebar").innerHTML; sidebar.scrollTop = scroll;
    if (!frame) { last = performance.now(); frame = requestAnimationFrame(animate); }
  };
  const poll = () => {
    if (!active) return;
    const script = document.createElement("script");
    script.nonce = document.currentScript?.nonce || document.body.dataset.nonce;
    script.src = "meter-frame.js?t=" + Date.now();
    script.onload = script.onerror = () => { script.remove(); if (active) setTimeout(poll, 200); };
    document.head.append(script);
  };
  poll();
})();`;

const atomicText = (path: string, text: string): void => {
  const temp = `${path}.${process.pid}.tmp`;
  writeFileSync(temp, text, { mode: 0o600 });
  renameSync(temp, path);
};
export const meterDocument = (state: State): string => {
  const nonce = randomBytes(18).toString("base64");
  return dashboardHTML(state)
    .replace("style-src 'unsafe-inline';", `style-src 'unsafe-inline'; script-src 'nonce-${nonce}';`)
    .replace(
      "<body>",
      `<body data-running="${state.phase !== "done" && state.phase !== "error" ? "1" : "0"}" data-nonce="${nonce}">`,
    )
    .replace("</body>", `<script nonce="${nonce}">${meterClient}</script></body>`);
};
export const updateMeter = (session: string, state: State, reset: boolean): string => {
  const dir = sessionDir(session),
    path = join(dir, "meter.html");
  const payload = JSON.stringify({
    html: dashboardHTML(state),
    running: state.phase !== "done" && state.phase !== "error",
  }).replaceAll("<", "\\u003c");
  atomicText(join(dir, "meter-frame.js"), `window.speedtestUpdate(${payload});`);
  if (reset || !existsSync(path)) atomicText(path, meterDocument(state));
  return path;
};
