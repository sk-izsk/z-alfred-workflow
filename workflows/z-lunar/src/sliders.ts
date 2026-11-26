import type { Display } from "./lunar.ts";
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
const localData = (url: string): URLSearchParams | null =>
  url.startsWith("about:blank#") ? new URLSearchParams(url.slice(12)) : null;
export const sliderChange = (url: string): { display: string; property: string; value: string } | null => {
  const data = localData(url);
  if (!data) return null;
  const display = data.get("display") || "",
    property = data.get("property") || "",
    value = data.get("value") || "";
  if (
    !/^[0-9]+$/.test(display) ||
    !["brightness", "contrast", "volume"].includes(property) ||
    !/^\d{1,3}$/.test(value) ||
    Number(value) > 100
  )
    return null;
  return { display, property, value };
};
export const selectorChange = (url: string): { action: string; display: string; value: string } | null => {
  const data = localData(url);
  if (!data) return null;
  const action = data.get("action") || "",
    display = data.get("display") || "",
    value = data.get("value") || "";
  if (
    !["input", "adaptive", "preset"].includes(action) ||
    !/^\d+$/.test(display) ||
    !value ||
    value.length > 200 ||
    [...value].some((c) => c.charCodeAt(0) < 32)
  )
    return null;
  return { action, display, value };
};
export const sliderHTML = (
  display?: Display,
  backShortcut = "⌃⌥⇧⌘B",
  actionsShortcut = "⌘K",
  model: { adaptive: string; presets: string[] } = { adaptive: "off", presets: [] },
): string => {
  const fields = [
    { key: "brightness", label: "Brightness", icon: "☀" },
    { key: "contrast", label: "Contrast", icon: "◐" },
    {
      key: "volume",
      label: "Volume",
      icon: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3zM16 8c3 2 3 6 0 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    },
  ] as const;
  const options = (values: string[], selected = "") =>
    values
      .map(
        (value) =>
          `<option value="${escape(value)}" ${selected === value ? "selected" : ""}>${escape(value)}</option>`,
      )
      .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'"><style>
 :root{color-scheme:light dark;font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:light-dark(#252525,#eee)}*{box-sizing:border-box}html,body{margin:0;background:transparent}body{overflow:auto;scrollbar-width:none}body::-webkit-scrollbar{display:none}.card{padding:10px 14px;border:1px solid #8883;border-radius:16px;background:light-dark(#00000005,#ffffff08)}.control{display:grid;grid-template-columns:26px minmax(40px,1fr) 56px;align-items:center;gap:10px;height:34px}.symbol{font-size:23px;color:#aaa;display:flex;align-items:center}.control:first-child .symbol,.control:first-child output{color:#edaf32}.control:first-child output{font-size:28px;font-weight:500}output{text-align:right;font-variant-numeric:tabular-nums;font-size:15px;font-weight:600;color:light-dark(#555,#bbb)}input{appearance:none;-webkit-appearance:none;width:100%;height:5px;border-radius:6px;outline:none;background:linear-gradient(to right,#c9c2b5 0 var(--fill),#8885 var(--fill) 100%);cursor:pointer;margin:0}input::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:#d9c8a5;border:2px solid #fff9;box-shadow:0 1px 4px #0006}input:focus-visible{outline:2px solid #6ea2db;outline-offset:6px}input:disabled{opacity:.3;cursor:default}.control:first-child input{height:7px;background:linear-gradient(to right,#edaf32 0 var(--fill),#8885 var(--fill) 100%)}.control:first-child input::-webkit-slider-thumb{width:19px;height:19px;border-color:#edaf32;background:#f5c55a;box-shadow:0 0 0 3px #edaf3220}.presets{display:flex;gap:7px;margin:11px 0}.presets button{flex:1;border:1px solid #8883;border-radius:10px;background:light-dark(#00000009,#ffffff0c);color:inherit;font:600 12px -apple-system;padding:7px 0;cursor:pointer}.presets button:hover{background:#b79d6a33;border-color:#d8b45f88}.selectors{display:grid;gap:8px}.select-wrap{position:relative;border:1px solid #8883;border-radius:13px;background:light-dark(#00000005,#ffffff08);transition:background .15s,border-color .15s}.select-wrap:hover{background:light-dark(#0000000c,#ffffff10);border-color:#aaa6}.select-wrap:focus-within{border-color:#a79060}.select-wrap label{position:absolute;top:6px;left:12px;font-size:9px;letter-spacing:.55px;font-weight:600;opacity:.5;pointer-events:none}.select-wrap:after{content:'⌄';position:absolute;right:13px;top:14px;font-size:18px;opacity:.6;pointer-events:none}select{appearance:none;-webkit-appearance:none;width:100%;height:44px;border:0;background:transparent;color:inherit;padding:16px 34px 3px 12px;font:500 13px -apple-system;outline:none;cursor:pointer}option{background:light-dark(#f3f3f3,#292929);color:light-dark(#222,#eee)}.info{font-size:10px;opacity:.5;margin:9px 2px 0}
 </style></head><body><section class="card" aria-label="Display levels">
 ${fields
   .map((field) => {
     const value = display?.[field.key] ?? null;
     return `<div class="control"><span class="symbol" aria-hidden="true">${field.icon}</span><input type="range" min="0" max="100" step="1" id="${field.key}" aria-label="${field.label}" value="${value ?? 0}" style="--fill:${value ?? 0}%" ${value === null ? "disabled" : ""}><output for="${field.key}">${value === null ? "—" : `${value}${field.key === "brightness" ? "%" : ""}`}</output></div>`;
   })
   .join("")}
 </section><div class="presets" aria-label="Brightness presets">${[0, 25, 50, 75, 100].map((n) => `<button type="button" data-level="${n}" ${display ? "" : "disabled"}>${n}%</button>`).join("")}</div>
 <div class="selectors"><div class="select-wrap"><label for="input">VIDEO INPUT</label><select id="input" aria-label="Video input"><option value="">Choose input…</option>${options(display?.inputs || [])}</select></div>
 <div class="select-wrap"><label for="adaptive">ADAPTIVE · ALL DISPLAYS</label><select id="adaptive" aria-label="Adaptive mode for all displays">${[
   ["off", "Manual"],
   ["synced", "Synced"],
   ["sun", "Sun position"],
   ["system", "macOS sensor"],
   ["ambient", "Ambient light"],
   ["auto", "Automatic"],
 ]
   .map(
     ([value, label]) =>
       `<option value="${value}" ${model.adaptive === value ? "selected" : ""}>${label}</option>`,
   )
   .join("")}</select></div>
 <div class="select-wrap"><label for="preset">SAVED SETUP · ALL DISPLAYS</label><select id="preset" aria-label="Saved display preset"><option value="">Apply saved preset…</option>${options(model.presets)}</select></div></div>
 <p class="info">${display ? escape(`${display.controlMethod} · ${display.hasDDC ? "DDC available" : "DDC unavailable"} · ${display.active ? "Active" : "Inactive"}`) : "Select a display"}</p>
 <script>const display=${JSON.stringify(display?.id || "")};let timer;
 function send(data){if(!display)return;location.hash=new URLSearchParams({display,...data,nonce:String(Date.now())}).toString();}
 function paint(input){input.style.setProperty('--fill',input.value+'%');input.nextElementSibling.textContent=input.value+(input.id==='brightness'?'%':'');}
 document.querySelectorAll('input').forEach(input=>{input.addEventListener('input',()=>paint(input));input.addEventListener('change',()=>{clearTimeout(timer);timer=setTimeout(()=>send({property:input.id,value:input.value}),140);});});
 document.querySelectorAll('[data-level]').forEach(button=>button.addEventListener('click',()=>send({property:'brightness',value:button.dataset.level})));
 document.querySelectorAll('select').forEach(select=>select.addEventListener('change',()=>{if(select.value)send({action:select.id,value:select.value});}));
 function match(event,shortcut){const key=shortcut.replace(/[⌃⌥⇧⌘]/g,'').toLowerCase();return event.key.toLowerCase()===key&&event.ctrlKey===shortcut.includes('⌃')&&event.altKey===shortcut.includes('⌥')&&event.shiftKey===shortcut.includes('⇧')&&event.metaKey===shortcut.includes('⌘');}
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();location.hash='action=close';}else if(match(event,${JSON.stringify(backShortcut)})){event.preventDefault();location.hash='action=back';}else if(match(event,${JSON.stringify(actionsShortcut)})){event.preventDefault();location.hash='action=menu';}});
 </script></body></html>`;
};
