// The map: a self-contained HTML file per render, loaded by the webkitview through `src`.
import type { Lang } from "./i18n.ts";
import type { LngLat, Option } from "./model.ts";
import type { Style, Tiles } from "./settings.ts";

export type PageLeg = {
  coords: LngLat[];
  color?: string;
  walk: boolean;
  line?: string;
  textColor?: string;
};
export type PagePoint = {
  lon: number;
  lat: number;
  kind: "start" | "stop" | "end" | "transfer";
  label: string;
};
export type PageOption = { legs: PageLeg[]; label: string; transfers: PagePoint[] };
export type PageData = {
  tiles: Tiles;
  /** HERE tile key (in the data) or Google Maps key (only in the script URL). */
  tilesKey?: string;
  style: Style;
  lang: Lang;
  scale: number;
  stopNames: boolean;
  chosen: number;
  options: PageOption[];
  points: PagePoint[];
  attribution: string;
  /** With nothing to show yet: the area searches start from ([lon, lat]). */
  center?: [number, number];
};

const MODE_COLOUR: Record<string, string> = { BIKE: "#30b158", WALK: "#8e8e93" };

export const pageOption = (option: Option, label: string): PageOption => ({
  label,
  legs: option.legs.map((l) => ({
    coords: l.coords,
    color: l.color ?? MODE_COLOUR[l.mode],
    walk: l.mode === "WALK",
    line: l.transit ? l.line : undefined,
    textColor: l.textColor,
  })),
  transfers: option.legs
    .filter((l) => l.transit)
    .flatMap((l) => [l.from, l.to])
    .filter((s, i, all) => all.findIndex((o) => o.name === s.name) === i)
    .map((s) => ({ lon: s.lon, lat: s.lat, kind: "transfer" as const, label: s.name })),
});

/** Runs in the web view; must not reference anything outside its own body. */
function mapScript(D: PageData): void {
  const W = window as any;
  const query = new URLSearchParams(location.search);
  const chosen = query.has("alt") ? Number(query.get("alt")) : D.chosen;
  const dark =
    D.style === "dark" || (D.style === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.className = dark ? "dark" : "light";
  const P = dark
    ? {
        land: "#24262b",
        water: "#1c3550",
        park: "#22332a",
        building: "#2c2f35",
        minor: "#33363d",
        major: "#4a4e57",
        motorway: "#5a5e68",
        casing: "#1b1c20",
        text: "#b9bcc4",
        place: "#d0d3da",
        alt: "#5d8ccc",
        routeCasing: "#0d0e10",
      }
    : {
        land: "#f2f1ed",
        water: "#c3d9ee",
        park: "#dcebcf",
        building: "#e5e2db",
        minor: "#ffffff",
        major: "#ffffff",
        motorway: "#fde7a4",
        casing: "#d6d2c9",
        text: "#5f6368",
        place: "#3c4043",
        alt: "#8fb8f2",
        routeCasing: "#ffffff",
      };
  const CHOSEN = "#0a84ff";
  const S = D.scale;
  const fail = (message: string) => {
    document.body.innerHTML = `<p class="err">${message}</p>`;
  };

  const big = /country|state|city|capital|continent|water|sea|ocean|marine|lake|bay/;
  const recolour = (style: any) => {
    const lang = D.lang;
    for (const l of style.layers) {
      const id = `${l.id} ${l["source-layer"] ?? ""}`.toLowerCase();
      const p = (l.paint ??= {});
      if (l.type === "background") p["background-color"] = P.land;
      else if (l.type === "fill") {
        if (/water|ocean/.test(id)) p["fill-color"] = P.water;
        else if (/park|wood|grass|forest|landcover|nature|cemetery/.test(id)) p["fill-color"] = P.park;
        else if (/building/.test(id)) p["fill-color"] = P.building;
        else if (/landuse|residential/.test(id)) p["fill-color"] = P.land;
      } else if (l.type === "fill-extrusion") p["fill-extrusion-color"] = P.building;
      else if (l.type === "line") {
        if (/water|river|stream/.test(id)) p["line-color"] = P.water;
        else if (
          /transportation|road|highway|street|motorway|bridge|tunnel/.test(id) &&
          !/rail|transit/.test(id)
        )
          p["line-color"] = /casing|outline/.test(id)
            ? P.casing
            : /motorway/.test(id)
              ? P.motorway
              : /trunk|primary|secondary|major/.test(id)
                ? P.major
                : P.minor;
      } else if (l.type === "symbol" && l.layout?.["text-field"]) {
        p["text-color"] = /place|city|town|village|country|state/.test(id) ? P.place : P.text;
        p["text-halo-color"] = P.land;
        const field = JSON.stringify(l.layout["text-field"]);
        if (!/name/.test(field)) continue; // ref labels (road numbers) stay as they are
        const isBig = big.test(id);
        const base = isBig ? ["coalesce", ["get", `name:${lang}`], ["get", "name"]] : ["get", "name"];
        const latin = isBig
          ? ["coalesce", ["get", `name:${lang}`], ["get", "name:latin"], ["get", "name"]]
          : ["coalesce", ["get", "name:latin"], ["get", "name"]];
        l.layout["text-field"] = [
          "case",
          ["all", ["has", "name:nonlatin"], ["has", "name:latin"]],
          ["concat", latin, "\n", ["get", "name:nonlatin"]],
          base,
        ];
      }
    }
    return style;
  };

  const loadStyle = async (): Promise<any> => {
    if (D.tiles === "here" && D.tilesKey)
      return {
        version: 8,
        sources: {
          here: {
            type: "raster",
            tiles: [
              `https://maps.hereapi.com/v3/base/mc/{z}/{x}/{y}/png8?style=${dark ? "explore.night" : "explore.day"}&lang=${D.lang}&apiKey=${encodeURIComponent(D.tilesKey)}`,
            ],
            tileSize: 256,
            maxzoom: 20,
          },
        },
        layers: [{ id: "here", type: "raster", source: "here" }],
      };
    const url = `https://tiles.openfreemap.org/styles/${dark ? "dark" : "positron"}`;
    try {
      const response = await fetch(url);
      return recolour(await response.json());
    } catch {
      return url;
    }
  };

  const el = (cls: string, text = "", style = "") => {
    const node = document.createElement("div");
    node.className = cls;
    node.textContent = text;
    if (style) node.setAttribute("style", style);
    return node;
  };
  const withLabel = (dot: HTMLElement, label: string, left = false) => {
    const wrap = el("pin");
    wrap.append(dot);
    if (label) wrap.append(el(left ? "lbl left" : "lbl", label));
    return wrap;
  };
  const pick = (i: number) => {
    location.search = `?alt=${i}&t=${Date.now()}`;
  };

  const all: [number, number][] = [
    ...D.options.flatMap((o) => o.legs.flatMap((l) => l.coords)),
    ...D.points.map((p) => [p.lon, p.lat] as [number, number]),
  ];

  // The point farthest from the chosen route: where an alternative diverges most.
  const divergence = (alt: [number, number][], main: [number, number][]) => {
    const step = (n: number, max: number) => Math.max(1, Math.floor(n / max));
    const mainSample = main.filter((_, i) => i % step(main.length, 400) === 0);
    const k = Math.cos(((main[0]?.[1] ?? 0) * Math.PI) / 180);
    let best = alt[Math.floor(alt.length / 2)];
    let bestDistance = -1;
    for (let i = 0; i < alt.length; i += step(alt.length, 200)) {
      const a = alt[i] as [number, number];
      let near = Infinity;
      for (const b of mainSample) near = Math.min(near, ((a[0] - b[0]) * k) ** 2 + (a[1] - b[1]) ** 2);
      if (near > bestDistance) {
        bestDistance = near;
        best = a;
      }
    }
    // Same track as the chosen route (e.g. a later train): no chip, the 1–3 buttons still pick it.
    return bestDistance > 1e-6 ? best : undefined;
  };

  // Stops on top of the start, a stop or the destination already have a marker there.
  const near = (s: PagePoint) =>
    D.points.some((p) => Math.abs(p.lat - s.lat) < 0.003 && Math.abs(p.lon - s.lon) < 0.004);
  // Start and end labels face away from each other so they stay inside the map.
  const pointElement = (p: PagePoint) => {
    const first = D.points[0];
    const last = D.points.at(-1);
    return p.kind === "end"
      ? withLabel(el("endpin"), p.label, D.points.length > 1 && p.lon > (first?.lon ?? 0))
      : withLabel(
          el(`dot ${p.kind}`),
          p.kind === "start" ? p.label : "",
          p.kind === "start" && last !== undefined && p.lon > last.lon,
        );
  };
  const main = D.options[chosen];
  const mainCoords = main ? main.legs.flatMap((l) => l.coords) : [];
  const badgeStyle = (colour = CHOSEN, text = "#fff") => `background:${colour};color:${text}`;

  /** Google Maps JavaScript API: its own map (default look in light mode), our routes on top. */
  const drawGoogle = () => {
    const g = W.google.maps;
    const Base: any = g.OverlayView;
    // HTML markers (dots, labels, chips, badges) positioned by Google's projection.
    class Html extends Base {
      at: any;
      node: HTMLElement;
      anchor: string;
      constructor(lonLat: [number, number], node: HTMLElement, anchor = "center") {
        super();
        this.at = new g.LatLng(lonLat[1], lonLat[0]);
        this.node = node;
        this.anchor = anchor;
        node.style.position = "absolute";
      }
      onAdd() {
        this.getPanes().overlayMouseTarget.append(this.node);
        g.OverlayView.preventMapHitsAndGesturesFrom(this.node);
      }
      draw() {
        const p = this.getProjection().fromLatLngToDivPixel(this.at);
        if (!p) return;
        const { offsetWidth: w, offsetHeight: h } = this.node;
        this.node.style.left = `${p.x - w / 2}px`;
        this.node.style.top = `${this.anchor === "bottom" ? p.y - h : p.y - h / 2}px`;
      }
      onRemove() {
        this.node.remove();
      }
    }
    const latLng = ([lon, lat]: [number, number]) => ({ lat, lng: lon });
    const map = new g.Map(document.getElementById("m"), {
      center: latLng(all[0] ?? D.center ?? [0, 20]),
      zoom: all.length || D.center ? 12 : 2,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: "greedy",
      clickableIcons: false,
      backgroundColor: P.land,
      styles: dark
        ? [
            { elementType: "geometry", stylers: [{ color: P.land }] },
            { elementType: "labels.text.fill", stylers: [{ color: P.text }] },
            { elementType: "labels.text.stroke", stylers: [{ color: P.land }] },
            {
              featureType: "administrative.locality",
              elementType: "labels.text.fill",
              stylers: [{ color: P.place }],
            },
            { featureType: "water", elementType: "geometry", stylers: [{ color: P.water }] },
            { featureType: "poi.park", elementType: "geometry", stylers: [{ color: P.park }] },
            { featureType: "road", elementType: "geometry.fill", stylers: [{ color: P.minor }] },
            { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: P.casing }] },
            { featureType: "road.arterial", elementType: "geometry.fill", stylers: [{ color: P.major }] },
            { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: P.motorway }] },
            { featureType: "transit", elementType: "geometry", stylers: [{ color: P.building }] },
          ]
        : null,
    });
    const line = (coords: [number, number][], options: any) =>
      new g.Polyline({ path: coords.map(latLng), map, clickable: false, strokeOpacity: 1, ...options });
    D.options.forEach((o, i) => {
      if (i === chosen) return;
      const coords = o.legs.flatMap((l) => l.coords);
      line(coords, { strokeColor: P.alt, strokeWeight: 5 * S, zIndex: 1 });
      line(coords, {
        strokeColor: "#000",
        strokeOpacity: 0.01,
        strokeWeight: 22,
        zIndex: 2,
        clickable: true,
      }).addListener("click", () => pick(i));
      const at = divergence(coords, mainCoords);
      if (at) {
        const chip = el("chip", o.label);
        chip.addEventListener("click", () => pick(i));
        new Html(at, chip).setMap(map);
      }
    });
    if (main) {
      for (const l of main.legs) {
        line(l.coords, { strokeColor: P.routeCasing, strokeWeight: 10 * S, zIndex: 3 });
        const colour = l.color ?? CHOSEN;
        line(
          l.coords,
          l.walk
            ? {
                strokeOpacity: 0,
                zIndex: 4,
                icons: [
                  {
                    icon: {
                      path: g.SymbolPath.CIRCLE,
                      scale: 2.2 * S,
                      fillColor: colour,
                      fillOpacity: 1,
                      strokeOpacity: 0,
                    },
                    offset: "0",
                    repeat: "10px",
                  },
                ],
              }
            : { strokeColor: colour, strokeWeight: 5.5 * S, zIndex: 4 },
        );
        const mid = l.coords[Math.floor(l.coords.length / 2)];
        if (l.line && mid) new Html(mid, el("badge", l.line, badgeStyle(l.color, l.textColor))).setMap(map);
      }
      for (const s of main.transfers.filter((stop) => !near(stop)))
        new Html([s.lon, s.lat], withLabel(el("dot xfer"), D.stopNames ? s.label : "")).setMap(map);
    }
    for (const p of D.points)
      new Html([p.lon, p.lat], pointElement(p), p.kind === "end" ? "bottom" : "center").setMap(map);
    if (all.length > 1) {
      const bounds = new g.LatLngBounds();
      for (const c of all) bounds.extend(latLng(c));
      map.fitBounds(bounds, { top: 46, bottom: 72, left: 60, right: 60 });
      g.event.addListenerOnce(map, "idle", () => map.getZoom() > 16 && map.setZoom(16));
    } else if (all[0]) map.setZoom(15);
    const credit = el("credit", D.attribution);
    document.body.append(credit);
  };

  if (D.tiles === "google") {
    W.__zmapGoogle = drawGoogle;
    W.gm_authFailure = () =>
      fail("Google rejected the API key. Enable the Maps JavaScript API for it, or choose another map.");
    return;
  }

  const gl = W.maplibregl;
  if (!gl) {
    fail("Map library could not be loaded. Are you offline?");
    return;
  }

  void loadStyle().then((style) => {
    const map = new gl.Map({
      container: "m",
      style,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      maxPitch: 0,
      center: all[0] ?? D.center ?? [0, 20],
      zoom: all.length || D.center ? 12 : 1.5,
    });
    map.addControl(
      new gl.AttributionControl({ compact: true, customAttribution: D.attribution }),
      "bottom-right",
    );
    map.addControl(new gl.NavigationControl({ showCompass: false }), "bottom-right");
    map.scrollZoom.setWheelZoomRate(1 / 250);
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();

    // Trackpad pinch arrives as Safari gesture events in WKWebView.
    const box = map.getCanvasContainer();
    let startZoom = 0;
    box.addEventListener("gesturestart", (e: any) => {
      e.preventDefault();
      startZoom = map.getZoom();
    });
    box.addEventListener("gesturechange", (e: any) => {
      e.preventDefault();
      const r = box.getBoundingClientRect();
      map.easeTo({
        zoom: startZoom + Math.log2(e.scale),
        duration: 0,
        around: map.unproject([e.clientX - r.left, e.clientY - r.top]),
      });
    });

    map.on("load", () => {
      const line = (id: string, coords: [number, number][], paint: any) => {
        map.addSource(id, {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: coords },
          },
        });
        map.addLayer({
          id,
          type: "line",
          source: id,
          layout: { "line-cap": "round", "line-join": "round" },
          paint,
        });
      };
      D.options.forEach((o, i) => {
        if (i === chosen) return;
        const coords = o.legs.flatMap((l) => l.coords);
        line(`alt${i}`, coords, { "line-color": P.alt, "line-width": 5 * S });
        line(`hit${i}`, coords, { "line-color": "#000", "line-opacity": 0, "line-width": 22 });
        map.on("click", `hit${i}`, () => pick(i));
        map.on("mouseenter", `hit${i}`, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", `hit${i}`, () => (map.getCanvas().style.cursor = ""));
        const at = divergence(coords, mainCoords);
        if (at) {
          const chip = el("chip", o.label);
          chip.addEventListener("click", () => pick(i));
          new gl.Marker({ element: chip }).setLngLat(at).addTo(map);
        }
      });
      if (main) {
        main.legs.forEach((l, j) =>
          line(`case${j}`, l.coords, { "line-color": P.routeCasing, "line-width": 10 * S }),
        );
        main.legs.forEach((l, j) =>
          line(`leg${j}`, l.coords, {
            "line-color": l.color ?? CHOSEN,
            "line-width": 5.5 * S,
            ...(l.walk && { "line-dasharray": [0, 1.8] }),
          }),
        );
        for (const l of main.legs) {
          const mid = l.coords[Math.floor(l.coords.length / 2)];
          if (!l.line || !mid) continue;
          const badge = el("badge", l.line, badgeStyle(l.color, l.textColor));
          new gl.Marker({ element: badge }).setLngLat(mid).addTo(map);
        }
        for (const s of main.transfers.filter((stop) => !near(stop)))
          new gl.Marker({ element: withLabel(el("dot xfer"), D.stopNames ? s.label : "") })
            .setLngLat([s.lon, s.lat])
            .addTo(map);
      }
      for (const p of D.points) {
        new gl.Marker({ element: pointElement(p), anchor: p.kind === "end" ? "bottom" : "center" })
          .setLngLat([p.lon, p.lat])
          .addTo(map);
      }
      if (all.length > 1) {
        const bounds = new gl.LngLatBounds(all[0], all[0]);
        for (const c of all) bounds.extend(c);
        map.fitBounds(bounds, {
          padding: { top: 46, bottom: 72, left: 60, right: 60 },
          maxZoom: 16,
          duration: 0,
        });
      } else if (all[0]) map.jumpTo({ center: all[0], zoom: 15 });
    });
  });
}

const CSS = `html,body{margin:0;height:100%;overflow:hidden;font:12px -apple-system,BlinkMacSystemFont,sans-serif}
html,body{background:#f2f1ed}@media (prefers-color-scheme:dark){html,body{background:#24262b}}
html.dark,html.dark body{background:#24262b}html.light,html.light body{background:#f2f1ed}
#m{position:absolute;inset:0}
.err{margin:40px;color:#8e8e93;font-size:14px;text-align:center}
.dot{width:12px;height:12px;border-radius:50%;background:#fff;box-sizing:border-box;box-shadow:0 1px 3px #0005}
.dot.start{width:17px;height:17px;border:4px solid #0a84ff}
.dot.stop{width:15px;height:15px;border:3.5px solid #111}
.dot.xfer{width:11px;height:11px;border:2.5px solid #8e8e93}
.endpin{width:22px;height:30px;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 22 30'%3E%3Cpath d='M11 0C4.9 0 0 4.8 0 10.8 0 18.6 11 30 11 30s11-11.4 11-19.2C22 4.8 17.1 0 11 0z' fill='%23ea4335'/%3E%3Ccircle cx='11' cy='11' r='4' fill='%23a50e0e'/%3E%3C/svg%3E") no-repeat center/contain}
.lbl{position:absolute;left:calc(100% + 6px);top:50%;transform:translateY(-50%);white-space:nowrap;background:#fff;color:#1d1d1f;font-weight:600;padding:4px 8px;border-radius:6px;box-shadow:0 1px 4px #0004}
.endpin+.lbl{top:35%}
.lbl.left{left:auto;right:calc(100% + 6px)}
html.dark .lbl{background:#3a3c42;color:#f2f2f4}
.chip{background:#fff;color:#2f6fd6;font-weight:700;padding:3px 7px;border-radius:6px;box-shadow:0 1px 4px #0004;cursor:pointer}
html.dark .chip{background:#2c3b52;color:#cfe0ff}
.credit{position:absolute;right:6px;top:6px;font-size:10.5px;padding:2px 6px;border-radius:4px;background:#fffc;color:#333}
html.dark .credit{background:#000a;color:#ddd}
.badge{font-weight:700;padding:2px 6px;border-radius:4px;font-size:11.5px;box-shadow:0 1px 3px #0005;border:1.5px solid #fff}`;

/** One HTML file with the route data inline and MapLibre (unpkg, jsDelivr fallback) or Google Maps. */
export const mapPage = (data: PageData): string => {
  const google = data.tiles === "google";
  // The Google key belongs only in its script URL; HERE needs its key inside the tile URLs.
  const json = JSON.stringify({ ...data, tilesKey: google ? undefined : data.tilesKey }).replace(
    /</g,
    "\\u003c",
  );
  // Background from the first frame: never a white box while tiles or the library load.
  const theme = data.style === "auto" ? "" : ` class="${data.style}"`;
  if (google)
    return `<!doctype html><html${theme}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${CSS}</style></head><body><div id="m"></div>
<script>(${mapScript.toString()})(${json})</script>
<script async src="https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(data.tilesKey ?? "")}&language=${data.lang}&loading=async&callback=__zmapGoogle"></script></body></html>`;
  // MapLibre next to the page (copied from the workflow); unpkg, then jsDelivr, only if it's missing.
  return `<!doctype html><html${theme}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="maplibre-gl.css" onerror="this.onerror=null;this.href='https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css'">
<style>${CSS}</style></head><body><div id="m"></div>
<script src="maplibre-gl.js"></script>
<script>window.maplibregl||document.write('<script src="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js"><\\/script>')</script>
<script>window.maplibregl||document.write('<script src="https://cdn.jsdelivr.net/npm/maplibre-gl@5/dist/maplibre-gl.js"><\\/script>')</script>
<script>(${mapScript.toString()})(${json})</script></body></html>`;
};
