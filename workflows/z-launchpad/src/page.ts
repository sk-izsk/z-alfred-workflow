// The grid as a local web page: Alfred UI has no scroll, swipe or drag-and-drop events, so paging
// by trackpad or mouse wheel and dragging apps into folders need a web view (see README).
// The page sends changes back by navigating to `?op=…&s=<layout>`: Alfred reports the new URL to
// the script (`changed`), and the reloaded page draws the layout it carries.

export type PageApp = { name: string; icon: string; cat: string };
export type PageData = {
  apps: Record<string, PageApp>;
  pages: string[][];
  folders: Record<string, { name: string; apps: string[] }>;
  cols: number;
  rows: number;
  page: number;
  sel: string;
};

const CSS = `
:root { color-scheme: light dark; --sel: rgba(0,0,0,.10); --tint: rgba(0,0,0,.06); --fg: #1d1d1f; --muted: rgba(0,0,0,.45); --panel: rgba(246,246,248,.96); }
@media (prefers-color-scheme: dark) { :root { --sel: rgba(255,255,255,.14); --tint: rgba(255,255,255,.08); --fg: #f2f2f2; --muted: rgba(255,255,255,.45); --panel: rgba(44,44,48,.96); } }
* { box-sizing: border-box; -webkit-user-select: none; user-select: none; }
html, body { margin: 0; height: 100%; background: transparent; color: var(--fg); font: 13px -apple-system, BlinkMacSystemFont, sans-serif; overflow: hidden; }
#bar { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); width: min(420px, 60%); display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 8px; background: #00000033; }
#q { flex: 1; border: 0; outline: 0; background: transparent; color: var(--fg); font-size: 16px; -webkit-user-select: text; user-select: text; }
#q::placeholder { color: var(--muted); }
#help { border: 0; background: transparent; color: var(--fg); opacity: .2; font-size: 16px; cursor: pointer; padding: 0; }
#pager { position: absolute; top: 64px; bottom: 44px; left: 0; right: 0; display: flex; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; scrollbar-width: none; }
#pager::-webkit-scrollbar { display: none; }
.page, #results { flex: 0 0 100%; scroll-snap-align: start; display: grid; gap: 16px; padding: 16px 28px; }
#results { position: absolute; top: 64px; bottom: 44px; left: 0; right: 0; display: none; }
body.searching #results { display: grid; } body.searching #pager, body.searching #dots { visibility: hidden; }
.tile { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; border-radius: 16px; padding: 8px; min-width: 0; cursor: default; position: relative; }
.tile.sel { background: var(--sel); }
.tile img, .tile .fi { width: 64px; height: 64px; flex: none; pointer-events: none; }
.tile span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; pointer-events: none; }
.fi { border-radius: 14px; background: var(--tint); display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; padding: 7px; }
.fi img { width: 100%; height: auto; }
.tile.dragging { opacity: .25; }
.tile.merge .fi, .tile.merge img { transform: scale(1.12); transition: transform .12s; }
.tile.merge { background: var(--sel); }
.tile.before::before, .tile.after::after { content: ""; position: absolute; top: 12%; bottom: 12%; width: 3px; border-radius: 2px; background: #0a84ff; }
.tile.before::before { left: -9px; } .tile.after::after { right: -9px; }
#ghost { position: fixed; width: 64px; height: 64px; pointer-events: none; z-index: 50; display: none; }
#dots { position: absolute; bottom: 14px; left: 0; right: 0; display: flex; justify-content: center; gap: 12px; }
#dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--fg); opacity: .2; cursor: pointer; }
#dots i.on { opacity: 1; }
#shade { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,.25); z-index: 10; }
#shade.on { display: flex; }
#folder { width: min(720px, 80%); max-height: 80%; overflow: auto; border-radius: 22px; background: var(--panel); padding: 18px 22px 22px; box-shadow: 0 20px 60px rgba(0,0,0,.35); }
#fname { display: block; margin: 0 auto 12px; width: 60%; text-align: center; font-size: 22px; font-weight: 600; border: 0; outline: 0; background: transparent; color: var(--fg); border-radius: 8px; -webkit-user-select: text; user-select: text; }
#fname:focus { background: var(--tint); }
#fgrid { display: grid; gap: 14px; }
#menu { position: fixed; z-index: 60; display: none; min-width: 190px; padding: 5px; border-radius: 8px; background: var(--panel); box-shadow: 0 8px 30px rgba(0,0,0,.3); }
#menu div { padding: 5px 12px; border-radius: 5px; cursor: default; }
#menu div:hover { background: #0a84ff; color: white; }
#menu hr { border: 0; height: 1px; background: var(--tint); margin: 4px 6px; }
#sheet { display: none; } #shade.help #folder { display: none; } #shade.help #sheet { display: grid; }
#sheet { grid-template-columns: auto auto; gap: 4px 18px; padding: 28px 32px; border-radius: 18px; background: var(--panel); box-shadow: 0 20px 60px rgba(0,0,0,.35); }
#sheet b { text-align: right; font-weight: 500; } #sheet .gap { height: 10px; }
`;

// The page script. Kept as a string so the bundle ships one self-contained HTML file per window.
const JS = `
const D = JSON.parse(document.getElementById("data").textContent);
const Q = new URLSearchParams(location.search);
if (Q.get("s")) { try { Object.assign(D, JSON.parse(decodeURIComponent(escape(atob(Q.get("s").replace(/-/g, "+").replace(/_/g, "/")))))); } catch (e) {} }
const SIZE = D.cols * D.rows;
const $ = (id) => document.getElementById(id);
const pager = $("pager"), results = $("results"), dots = $("dots"), q = $("q"), shade = $("shade");
let openFolder = null, searching = [], navigating = false;

// ---- sending changes back ----
const b64 = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/, "");
const send = (op, arg = "") => {
  if (navigating) return; navigating = true;
  const s = b64(JSON.stringify({ pages: D.pages, folders: D.folders, page: D.page, sel: D.sel }));
  location.search = "?op=" + op + "&arg=" + encodeURIComponent(arg) + "&s=" + s + "&n=" + Date.now();
};
const save = () => send("save");

// ---- model helpers ----
const isF = (slot) => slot.startsWith("folder:");
const fid = (slot) => slot.slice(7);
const label = (slot) => isF(slot) ? D.folders[fid(slot)].name : D.apps[slot].name;
const where = (slot) => { for (let p = 0; p < D.pages.length; p++) { const i = D.pages[p].indexOf(slot); if (i >= 0) return [p, i]; } return null; };
const folderOf = (app) => Object.keys(D.folders).find((k) => D.folders[k].apps.includes(app));
/** Keep every page at most SIZE slots by flowing extras forward; drop empty pages. */
const reflow = () => {
  for (let p = 0; p < D.pages.length; p++) {
    if (D.pages[p].length > SIZE) {
      const extra = D.pages[p].splice(SIZE);
      if (p + 1 >= D.pages.length) D.pages.push([]);
      D.pages[p + 1].unshift(...extra);
    }
  }
  D.pages = D.pages.filter((pg) => pg.length);
  D.page = Math.min(D.page, D.pages.length - 1);
};
const takeOut = (slot) => {
  const f = folderOf(slot);
  if (f && !D.pages.flat().includes(slot)) {
    const apps = D.folders[f].apps; apps.splice(apps.indexOf(slot), 1);
    if (apps.length < 2) { // a folder of one dissolves into its app, like Launchpad
      const [p, i] = where("folder:" + f); D.pages[p].splice(i, 1, ...apps); delete D.folders[f];
    }
    return;
  }
  const at = where(slot); if (at) D.pages[at[0]].splice(at[1], 1);
};
let folderSeq = Date.now() % 100000;
const merge = (dragged, target) => {
  if (dragged === target || isF(dragged)) return false;
  if (isF(target)) { takeOut(dragged); D.folders[fid(target)].apps.push(dragged); return true; }
  const [p, i] = where(target);
  takeOut(dragged);
  const [p2, i2] = where(target) || [p, i];
  const a = D.apps[target], b = D.apps[dragged];
  const id = "f" + (folderSeq++).toString(36);
  D.folders[id] = { name: a.cat && a.cat === b.cat ? a.cat : a.cat || b.cat || "Folder", apps: [target, dragged] };
  D.pages[p2][i2] = "folder:" + id;
  return true;
};
const moveTo = (slot, page, index) => {
  takeOut(slot);
  if (page >= D.pages.length) D.pages.push([]);
  D.pages[page].splice(Math.min(index, D.pages[page].length), 0, slot);
  reflow();
};
const ungroup = (f) => {
  const [p, i] = where("folder:" + f); D.pages[p].splice(i, 1, ...D.folders[f].apps); delete D.folders[f]; reflow();
};

// ---- drawing ----
// An icon load cut off by the page's own reload can be remembered as failed: retry it once.
const icon = (src) => {
  const img = new Image(); img.draggable = false; img.src = src;
  img.onerror = () => { if (!img.dataset.retried) { img.dataset.retried = "1"; img.src = src + "?r=" + Date.now(); } };
  return img;
};
const tile = (slot) => {
  const el = document.createElement("div"); el.className = "tile"; el.dataset.slot = slot;
  if (isF(slot)) {
    const f = D.folders[fid(slot)], fi = document.createElement("div"); fi.className = "fi";
    for (const a of f.apps.slice(0, 9)) fi.append(icon(D.apps[a].icon));
    el.append(fi);
  } else el.append(icon(D.apps[slot].icon));
  const s = document.createElement("span"); s.textContent = label(slot); el.append(s);
  if (slot === D.sel) el.classList.add("sel");
  return el;
};
const gridStyle = (el, cols, rows) => { el.style.gridTemplateColumns = "repeat(" + cols + ", minmax(0, 1fr))"; if (rows) el.style.gridTemplateRows = "repeat(" + rows + ", minmax(0, 1fr))"; };
const draw = () => {
  pager.replaceChildren(...D.pages.map((pg) => { const el = document.createElement("div"); el.className = "page"; gridStyle(el, D.cols, D.rows); el.append(...pg.map(tile)); return el; }));
  dots.replaceChildren(...D.pages.map((_, i) => { const d = document.createElement("i"); d.onclick = () => goPage(i); return d; }));
  markDots();
  if (openFolder) drawFolder();
};
const markDots = () => [...dots.children].forEach((d, i) => d.classList.toggle("on", i === D.page));
const goPage = (i, smooth = true) => {
  D.page = Math.max(0, Math.min(D.pages.length - 1, i));
  pager.scrollTo({ left: D.page * pager.clientWidth, behavior: smooth ? "smooth" : "instant" });
  markDots();
  const page = D.pages[D.page]; if (page && !page.includes(D.sel)) select(page[0]);
};
const select = (slot) => {
  D.sel = slot || "";
  for (const el of document.querySelectorAll(".tile")) el.classList.toggle("sel", el.dataset.slot === D.sel);
};
pager.addEventListener("scroll", () => { const p = Math.round(pager.scrollLeft / pager.clientWidth); if (p !== D.page) { D.page = p; markDots(); } }, { passive: true });

// Mouse wheel and vertical swipes flip pages; horizontal swipes scroll natively (with snapping).
let wheelSum = 0, wheelLock = 0;
pager.addEventListener("wheel", (e) => {
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  e.preventDefault();
  if (Date.now() < wheelLock) return;
  wheelSum += e.deltaY;
  if (Math.abs(wheelSum) > 40) { goPage(D.page + Math.sign(wheelSum)); wheelSum = 0; wheelLock = Date.now() + 450; }
}, { passive: false });

// ---- search (same matching as the original: name, word starts, initials) ----
const matches = (name, term) => {
  const words = name.split(/(?=[A-Z])| /).map((w) => w.toLowerCase()).filter(Boolean);
  return [name.toLowerCase(), ...words, words.map((w) => w[0]).join("")].some((n) => n.startsWith(term));
};
q.addEventListener("input", () => {
  const term = q.value.trim().toLowerCase();
  document.body.classList.toggle("searching", Boolean(term));
  if (!term) { searching = []; select(D.pages[D.page]?.[0]); return; }
  searching = Object.keys(D.apps).filter((id) => matches(D.apps[id].name, term)).slice(0, SIZE);
  gridStyle(results, D.cols, D.rows);
  results.replaceChildren(...searching.map(tile));
  select(searching[0]);
});

// ---- folders ----
const fname = $("fname"), fgrid = $("fgrid");
const drawFolder = () => {
  const f = D.folders[openFolder]; if (!f) { closeFolder(); return; }
  if (document.activeElement !== fname) fname.value = f.name;
  gridStyle(fgrid, Math.min(6, Math.max(3, f.apps.length)));
  fgrid.replaceChildren(...f.apps.map(tile));
};
const showFolder = (f, rename = false) => {
  openFolder = f; shade.className = "on"; drawFolder(); select(D.folders[f].apps[0]);
  if (rename) { fname.focus(); fname.select(); }
};
const closeFolder = () => {
  if (openFolder && D.folders[openFolder]) {
    const name = fname.value.trim().slice(0, 60) || D.folders[openFolder].name;
    if (name !== D.folders[openFolder].name) { D.folders[openFolder].name = name; D.sel = "folder:" + openFolder; openFolder = null; save(); return; }
  }
  const was = openFolder; openFolder = null; shade.className = "";
  if (was) select("folder:" + was);
};
fname.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); fname.blur(); closeFolder(); } e.stopPropagation(); });
shade.addEventListener("click", (e) => { if (e.target === shade) shade.classList.contains("help") ? (shade.className = "") : closeFolder(); });
$("help").onclick = () => { shade.className = "on help"; };

// ---- opening ----
const activate = (slot) => { if (!slot) return; if (isF(slot)) showFolder(fid(slot)); else send("open", slot); };

// ---- drag and drop (pointer events; HTML drag images can't be styled here) ----
const ghost = $("ghost");
let drag = null;
document.addEventListener("pointerdown", (e) => {
  hideMenu();
  const t = e.target.closest(".tile"); if (!t || e.button !== 0 || document.body.classList.contains("searching")) return;
  drag = { slot: t.dataset.slot, el: t, x: e.clientX, y: e.clientY, live: false, target: null, centre: false, mode: "", since: 0, edgeSince: 0 };
});
document.addEventListener("pointermove", (e) => {
  if (!drag) return;
  if (!drag.live) {
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
    drag.live = true; drag.el.classList.add("dragging");
    ghost.src = drag.el.querySelector("img")?.src || ""; ghost.style.display = "block";
  }
  ghost.style.left = e.clientX - 32 + "px"; ghost.style.top = e.clientY - 32 + "px";
  // Dragging out of an open folder takes the app out of it.
  if (openFolder && !$("folder").contains(document.elementFromPoint(e.clientX, e.clientY))) {
    const f = openFolder; openFolder = null; shade.className = "";
    const back = where("folder:" + f) || [D.page, 0];
    takeOut(drag.slot); D.pages[back[0]].splice(back[1] + 1, 0, drag.slot); reflow(); draw();
    drag.el = document.querySelector('.tile[data-slot="' + CSS.escape(drag.slot) + '"]') || drag.el; drag.el.classList.add("dragging");
    drag.moved = true;
  }
  for (const el of document.querySelectorAll(".merge,.before,.after")) el.classList.remove("merge", "before", "after");
  // Holding near the left or right edge turns the page.
  const edge = e.clientX < 30 ? -1 : e.clientX > innerWidth - 30 ? 1 : 0;
  if (edge && !openFolder) { drag.edgeSince ||= Date.now(); if (Date.now() - drag.edgeSince > 600) { goPage(D.page + edge); drag.edgeSince = Date.now(); } } else drag.edgeSince = 0;
  const over = document.elementFromPoint(e.clientX, e.clientY)?.closest(".tile");
  if (!over || over === drag.el) { drag.target = null; return; }
  const r = over.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
  const centre = fx > .25 && fx < .75 && fy > .15 && fy < .85;
  // The hold timer restarts only when the target or the zone (centre vs. edge) changes.
  if (drag.target !== over || drag.centre !== centre) { drag.target = over; drag.centre = centre; drag.since = Date.now(); }
  drag.mode = centre && !isF(drag.slot) && !openFolder && Date.now() - drag.since > 350 ? "merge" : fx < .5 ? "before" : "after";
  over.classList.add(drag.mode);
});
document.addEventListener("pointerup", () => {
  if (!drag) return;
  const d = drag; drag = null; ghost.style.display = "none";
  if (!d.live) { select(d.slot); activate(d.slot); return; }
  d.el.classList.remove("dragging");
  if (!d.target) { D.sel = d.slot; if (d.moved) save(); else draw(); return; }
  const target = d.target.dataset.slot;
  let changed = Boolean(d.moved);
  if (d.mode === "merge") changed = merge(d.slot, target) || changed;
  else if (openFolder) { // reorder inside the open folder
    const apps = D.folders[openFolder].apps; apps.splice(apps.indexOf(d.slot), 1);
    apps.splice(apps.indexOf(target) + (d.mode === "after" ? 1 : 0), 0, d.slot); changed = true;
  } else {
    takeOut(d.slot);
    const at = where(target); if (at) { D.pages[at[0]].splice(at[1] + (d.mode === "after" ? 1 : 0), 0, d.slot); reflow(); changed = true; }
  }
  D.sel = d.slot;
  if (changed) save(); else draw();
});

// ---- right-click menu ----
const menu = $("menu");
const hideMenu = () => { menu.style.display = "none"; };
document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  const t = e.target.closest(".tile"); if (!t) return hideMenu();
  const slot = t.dataset.slot; select(slot);
  const items = [];
  if (isF(slot)) {
    const f = fid(slot);
    items.push(["Open Folder", () => showFolder(f)], ["Rename Folder…", () => showFolder(f, true)], null, ["Delete Folder", () => { ungroup(f); save(); }]);
  } else {
    items.push(["Open", () => send("open", slot)], ["Show in Finder", () => send("reveal", slot)], ["Copy Path", () => send("copy", slot)]);
    if (folderOf(slot) && openFolder) items.push(null, ["Remove from Folder", () => { const f = openFolder; takeOut(slot); const at = where("folder:" + f); const [p, i] = at || [D.page, D.pages[D.page].length - 1]; D.pages[p].splice(i + 1, 0, slot); reflow(); openFolder = null; save(); }]);
    const folders = Object.keys(D.folders).filter((f) => !D.folders[f].apps.includes(slot));
    if (folders.length) { items.push(null); for (const f of folders.slice(0, 12)) items.push(["Add to “" + D.folders[f].name + "”", () => { takeOut(slot); D.folders[f].apps.push(slot); reflow(); save(); }]); }
  }
  menu.replaceChildren(...items.map((it) => { if (!it) return document.createElement("hr"); const d = document.createElement("div"); d.textContent = it[0]; d.onclick = () => { hideMenu(); it[1](); }; return d; }));
  menu.style.display = "block";
  menu.style.left = Math.min(e.clientX, innerWidth - menu.offsetWidth - 8) + "px";
  menu.style.top = Math.min(e.clientY, innerHeight - menu.offsetHeight - 8) + "px";
});

// ---- keyboard: the original workflow's shortcuts ----
const visible = () => openFolder ? D.folders[openFolder].apps : document.body.classList.contains("searching") ? searching : D.pages[D.page] || [];
const cols = () => openFolder ? Math.min(6, Math.max(3, D.folders[openFolder].apps.length)) : D.cols;
document.addEventListener("keydown", (e) => {
  if (e.target === fname) return;
  const list = visible(), i = Math.max(0, list.indexOf(D.sel)), c = cols();
  const step = { ArrowUp: -c, ArrowDown: c, ArrowLeft: -1, ArrowRight: 1 }[e.key];
  const editing = document.body.classList.contains("searching") || openFolder;
  if (e.ctrlKey && e.altKey && e.shiftKey && e.metaKey && e.code === "KeyB") { e.preventDefault(); return send("back"); }
  if (e.key === "Escape") {
    e.preventDefault();
    if (shade.className) { shade.classList.contains("help") ? (shade.className = "") : closeFolder(); return; }
    if (q.value) { q.value = ""; q.dispatchEvent(new Event("input")); return; }
    return send("close");
  }
  if (e.metaKey && (e.key === "?" || (e.shiftKey && e.key === "/"))) { e.preventDefault(); shade.className = "on help"; return; }
  if (e.metaKey && e.key === "k") { e.preventDefault(); return send("menu", D.sel); }
  if (e.key === "Enter") { e.preventDefault(); return activate(D.sel); }
  if (e.metaKey && e.key === "c" && D.sel && !isF(D.sel) && !window.getSelection().toString()) { e.preventDefault(); return send("copy", D.sel); }
  if (e.metaKey && /^[1-9]$/.test(e.key)) { e.preventDefault(); return goPage(Number(e.key) - 1); }
  if (e.metaKey && e.altKey && Math.abs(step) === 1 && !editing && D.sel) { // bump to the previous / next page
    e.preventDefault();
    if (D.page + step < 0) { takeOut(D.sel); D.pages.unshift([D.sel]); reflow(); D.page = 0; }
    else { moveTo(D.sel, D.page + step, SIZE); D.page = where(D.sel)[0]; }
    return save();
  }
  if (e.metaKey && e.key === "Backspace" && !editing && D.sel) { e.preventDefault(); moveTo(D.sel, D.pages.length, SIZE); D.page = where(D.sel)[0]; return save(); }
  if (e.metaKey && Math.abs(step) === 1) { e.preventDefault(); return goPage(D.page + step); }
  if (e.altKey && step && !editing && D.sel) { // shift position
    e.preventDefault(); const page = D.pages[D.page], j = page.indexOf(D.sel), k = j + step;
    if (j >= 0 && k >= 0 && k < page.length) { [page[j], page[k]] = [page[k], page[j]]; return save(); } return;
  }
  if (step && list.length) { e.preventDefault(); select(list[Math.min(list.length - 1, Math.max(0, i + step))]); return; }
  if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && document.activeElement !== q) q.focus();
});

draw();
goPage(D.page, false);
const known = D.pages.flat().concat(...Object.values(D.folders).map((f) => f.apps));
select(D.sel && known.includes(D.sel) ? D.sel : D.pages[D.page]?.[0]);
if (Q.get("help")) shade.className = "on help";
q.focus();
`;

const SHEET: [string, string][] = [
  ["↩", "Open selection and close window"],
  ["⎋", "Close folder, search or window"],
  ["⌘C", "Copy path"],
  ["", ""],
  ["↑ ↓ ← →", "Move selection"],
  ["⌘← ⌘→", "Previous / next page (or swipe, or scroll)"],
  ["⌘1–9", "Go to pages 1 through 9"],
  ["", ""],
  ["⌥↑ ⌥↓ ⌥← ⌥→", "Shift position"],
  ["⌘⌫", "Bump to end of list"],
  ["⌘⌥← ⌘⌥→", "Bump to previous / next page"],
  ["", ""],
  ["Drag onto an app", "Create a folder (hold for a moment)"],
  ["Drag between apps", "Reorder; hold at an edge to change page"],
  ["Right-click", "Show in Finder, add to folder, rename or delete folder"],
  ["⌘K", "Actions"],
  ["⌘?", "Open cheat sheet"],
];

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export const renderPage = (data: PageData): string => {
  // JSON inside <script>: escape `<` so app names can't close the tag.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const sheet = SHEET.map(([k, v]) =>
    k ? `<b>${escapeHtml(k)}</b><span>${escapeHtml(v)}</span>` : `<div class="gap"></div><div></div>`,
  ).join("");
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' file: data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
<style>${CSS}</style></head><body>
<div id="bar"><input id="q" placeholder="Search" autocomplete="off" spellcheck="false"><button id="help" title="Cheat sheet (⌘?)">?</button></div>
<div id="pager"></div><div id="results"></div><div id="dots"></div>
<div id="shade"><div id="folder"><input id="fname" maxlength="60" spellcheck="false"><div id="fgrid"></div></div><div id="sheet">${sheet}</div></div>
<div id="menu"></div><img id="ghost" alt="">
<script id="data" type="application/json">${json}</script>
<script>${JS}</script></body></html>`;
};
