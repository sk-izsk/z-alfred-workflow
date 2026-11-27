export type Lang = "en" | "de";
export type Locale = { lang: Lang; locale: string; hour12: boolean; metric: boolean };

const I18N = {
  en: {
    from: "From",
    to: "To",
    stop: "Stop {n}",
    routing: "Routing…",
    route: "Route",
    home: "Home",
    work: "Work",
    hint: "↩ Route · ⌘O {provider} · ⌘T swap",
    notFound: "Place not found: {q}",
    noRoute: "No {mode} route found",
    offline: "Network error: {msg}",
    needsTo: "Type a destination",
    dep: "dep {t}",
    arr: "arr {t}",
    direct: "direct",
    transfers: "{n}× transfer",
    walk: "{min} walk",
    stations: "{n} stops",
    station: "1 stop",
    transfer: "Transfer · {min}",
    platform: "Pl. {p}",
    late: "+{n} min",
    hour: "{h} h {m} min",
    hourOnly: "{h} h",
    min: "{m} min",
    car: "car",
    transit: "transit",
    bike: "bike",
    walkMode: "walking",
    openIn: "Open in {provider}",
    copyLink: "Copy {provider} Link",
    swap: "Swap From and To",
    addStop: "Add Stop",
    removeStop: "Remove Last Stop",
    savePlace: "Save Destination as Place…",
    removePlace: "Remove Saved Place “{label}”",
    clear: "Clear",
    saveTitle: "Save destination as a place",
    saveName: "Name",
    save: "Save",
    saved: "Saved “{label}”",
    setKey: "Set {provider} API Key…",
    removeKey: "Remove {provider} API Key",
    keyTitle: "{provider} API key",
    keyHelpGoogle:
      "From console.cloud.google.com with billing on. Enable Maps JavaScript API, Routes API and Places API (New), and restrict the key to those APIs.",
    keyHelpHere: "A REST API key from platform.here.com.",
    keyStored: "Kept in your macOS Keychain, not in Alfred’s preferences.",
    keySaved: "{provider} key saved in the Keychain",
    keyRemoved: "{provider} key removed",
    keyEmpty: "Paste a key first",
    keyMissing: "{provider} needs an API key in Workflow Configuration; using open data.",
    copied: "Link copied",
    suggestHint: "↓ ↑ choose · ↩ or click to use",
    noTransit: "No public transport data for this area",
    transitHint: "Open data has no timetables here. Google (Workflow Configuration) covers more cities.",
  },
  de: {
    from: "Von",
    to: "Nach",
    stop: "Halt {n}",
    routing: "Route wird gesucht…",
    route: "Route",
    home: "Zuhause",
    work: "Arbeit",
    hint: "↩ Route · ⌘O {provider} · ⌘T tauschen",
    notFound: "Ort nicht gefunden: {q}",
    noRoute: "Keine Route ({mode}) gefunden",
    offline: "Netzwerkfehler: {msg}",
    needsTo: "Ziel eingeben",
    dep: "ab {t}",
    arr: "an {t}",
    direct: "direkt",
    transfers: "{n}× umsteigen",
    walk: "{min} zu Fuß",
    stations: "{n} Stationen",
    station: "1 Station",
    transfer: "Umstieg · {min}",
    platform: "Gl. {p}",
    late: "+{n} Min",
    hour: "{h} Std {m} Min",
    hourOnly: "{h} Std",
    min: "{m} Min",
    car: "Auto",
    transit: "ÖPNV",
    bike: "Fahrrad",
    walkMode: "zu Fuß",
    openIn: "In {provider} öffnen",
    copyLink: "{provider}-Link kopieren",
    swap: "Start und Ziel tauschen",
    addStop: "Halt hinzufügen",
    removeStop: "Letzten Halt entfernen",
    savePlace: "Ziel als Ort speichern…",
    removePlace: "Gespeicherten Ort „{label}“ entfernen",
    clear: "Leeren",
    saveTitle: "Ziel als Ort speichern",
    saveName: "Name",
    save: "Speichern",
    saved: "„{label}“ gespeichert",
    setKey: "{provider}-API-Schlüssel festlegen…",
    removeKey: "{provider}-API-Schlüssel entfernen",
    keyTitle: "{provider}-API-Schlüssel",
    keyHelpGoogle:
      "Von console.cloud.google.com mit aktivierter Abrechnung. Maps JavaScript API, Routes API und Places API (New) aktivieren und den Schlüssel auf diese APIs beschränken.",
    keyHelpHere: "Ein REST-API-Schlüssel von platform.here.com.",
    keyStored: "Liegt im macOS-Schlüsselbund, nicht in Alfreds Einstellungen.",
    keySaved: "{provider}-Schlüssel im Schlüsselbund gespeichert",
    keyRemoved: "{provider}-Schlüssel entfernt",
    keyEmpty: "Zuerst einen Schlüssel einfügen",
    keyMissing:
      "{provider} braucht einen API-Schlüssel in der Workflow-Konfiguration; offene Daten werden genutzt.",
    copied: "Link kopiert",
    suggestHint: "↓ ↑ wählen · ↩ oder Klick übernimmt",
    noTransit: "Keine ÖPNV-Daten für diese Gegend",
    transitHint:
      "Offene Daten haben hier keine Fahrpläne. Google (Workflow-Konfiguration) deckt mehr Städte ab.",
  },
} satisfies Record<Lang, Record<string, string>>;
export type Key = keyof typeof I18N.en;

export const t = (lang: Lang, key: Key, vars: Record<string, string | number> = {}): string =>
  I18N[lang][key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ""));

export const pickLang = (setting: string, systemLocale: string): Lang =>
  setting === "en" || setting === "de" ? setting : systemLocale.toLowerCase().startsWith("de") ? "de" : "en";

/** Large duration: `1 h 36 min` / `1 Std 36 Min`. */
export const longDuration = (seconds: number, lang: Lang): string => {
  const total = Math.max(1, Math.round(seconds / 60));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return t(lang, "min", { m });
  return m ? t(lang, "hour", { h, m }) : t(lang, "hourOnly", { h });
};

/** Mode button: `31 min` or `1:04 h`. */
export const shortDuration = (seconds: number | undefined, lang: Lang): string => {
  if (seconds === undefined) return "–";
  const total = Math.max(1, Math.round(seconds / 60));
  const h = Math.floor(total / 60);
  return h ? `${h}:${String(total % 60).padStart(2, "0")} h` : t(lang, "min", { m: total });
};

/** `compact` drops a.m./p.m. so times fit the itinerary's narrow time column. */
export const clock = (ms: number, loc: Locale, compact = false): string =>
  new Intl.DateTimeFormat(loc.locale, { hour: "numeric", minute: "2-digit", hour12: loc.hour12 })
    .formatToParts(ms)
    .filter((part) => !(compact && part.type === "dayPeriod"))
    .map((part) => part.value)
    .join("")
    .trim();

export const distance = (metres: number, loc: Locale): string => {
  const number = (n: number, digits: number) =>
    new Intl.NumberFormat(loc.locale, { maximumFractionDigits: digits }).format(n);
  if (!loc.metric) {
    const miles = metres / 1609.344;
    return miles < 0.2 ? `${number(metres * 3.28084, 0)} ft` : `${number(miles, miles < 10 ? 1 : 0)} mi`;
  }
  return metres < 1000 ? `${number(metres, 0)} m` : `${number(metres / 1000, metres < 100_000 ? 1 : 0)} km`;
};
