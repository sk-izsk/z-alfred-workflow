# Maps for Alfred

Routes and place search on a live map inside Alfred 6: car, transit, bike and walk, with stops,
alternatives, suggestions while you type and a full transit itinerary. Open data by default, no
API key. Google (places, live-traffic routes and the Google map) or HERE are optional with your
own key.

![Transit in a city: S-Bahn itinerary, mode times and the route on the map](assets/screenshots/city-transit.png)

![Long-distance trip with five transfers, line badges and an alternative connection](assets/screenshots/long-distance.png)

Requires macOS, Alfred 6 with Powerpack, Node.js 22+ or Bun, and an internet connection.

## Search

| Type | Opens |
| --- | --- |
| `maps Eiffel Tower` | The place on the map |
| `maps A > B` or `maps from A to B` | A route |
| `maps A > B > C` or `maps from A via B to C` | A route with stops (up to three) |
| `maps von A über B nach C` | The same in German |
| `maps` with an address on the clipboard | A route from Home (if set) to the copied address |

While you type in From, To or a stop, suggestions drop down right under the fields, as in
Google Maps: your saved places first (★), then places from the provider. Use ↓ ↑ and ↩, or
click one. A picked suggestion is pinned to its exact place. Searches start near **Search near**
in Configuration, else near your Home address, else the city of your Mac's time zone; To and
stops search near From, and places within 100 km come first. Before anything is routed, the map
shows that area.

The Home, Work and saved-place buttons fill From while it is empty, otherwise To, and route
once both are set. For an exact pin, any field (and Home or Work in Configuration) also takes
coordinates such as `45.4995, -73.5665`, as copied from Google Maps; useful when an address
search lands on a neighbouring house number.

`home` (also `zuhause`, `daheim`) and `work` (also `office`, `arbeit`, `büro`) use the addresses
from Workflow Configuration. Saved places work by their label, so `maps gym > work` routes
between two saved places. Other workflows can open a route with the External Trigger `route`
and an argument like `Start > Destination`.

Places are found near the start: with `Alexanderplatz > Hauptbahnhof`, the destination is the
Hauptbahnhof nearest to Alexanderplatz. The start itself is searched near **Search near** in
Configuration, or the city of your Mac's time zone.

## Keys

| Key | Does |
| --- | --- |
| ↩ | Route, or use the highlighted suggestion. ↩ again (nothing changed) opens the route in Google Maps |
| ↓ / ↑ | Move through suggestions |
| ⌘O | Open the route in Google Maps, Apple Maps, OpenStreetMap or HERE WeGo (Configuration) |
| ⌘1 – ⌘4 | Car, transit, bike, walk |
| ⌘T | Swap From and To |
| ⌘U / ⇧⌘U | Add a stop / remove the last stop |
| ⌘K | Actions: open in another map app, copy link, save the destination as a place, remove saved places, clear |
| Hyper+B | Back to Alfred's search (configurable, shown in the footer) |

The opened link carries the addresses you typed (home and work expanded), the stops and the
mode, so Google Maps shows the same trip. OpenStreetMap directions take two points, so stops
are left out there.

## Window

The sidebar has From and To with a round + for stops, optional Home, Work and saved-place
buttons, the four modes with their times, the travel time with alternatives 1–3, the
departure and arrival line, and for transit the itinerary: coloured line bars, platforms,
transfers and delays in red.

The map shows the chosen route over a casing, walking parts dotted, a line badge for each ride,
transfer stops, the start (blue ring), stops (black ring) and the destination (red pin).
Alternatives are light blue with a time chip where they leave the chosen route; click a line or
chip to choose it. Scroll, pinch and double-click zoom; the map does not rotate. Labels follow
Google Maps: countries, regions, seas and cities in your language, streets and smaller places in
the local name, and non-Latin names with the Latin form above them.

The window is 1180 × 620 points by default (Window width and Map height in Configuration,
limited to the screen). This is wider than the repository's 780-point standard because the map
needs the room; see [UI_CONVENTIONS.md](../../UI_CONVENTIONS.md).

## Data, providers and privacy

**Routes and places** and **Map** are two settings, so you can, for example, route with open
data on a Google map, or route with Google on OpenFreeMap. **Map: Automatic** follows the routes.

| | Open data (default) | Google (your key) | HERE (your key) |
| --- | --- | --- | --- |
| Places and suggestions | Photon (search-as-you-type, addresses), Transitous as fallback | Places API (New) text search | HERE Geocoding & Search |
| Transit | Transitous (up to 3 connections) | Routes API, transit | HERE Public Transit |
| Car, bike, walk | Transitous times; FOSSGIS OSRM alternatives | Routes API (car with live traffic) | HERE Routing (car with traffic) |
| Map | OpenFreeMap with MapLibre GL, recoloured light/dark | Google Maps JavaScript API (Google's look; our dark palette in dark mode) | HERE map tiles (day/night) |

- **Keys:** add or remove them from **Actions (⌘K) → Set Google API Key… / Set HERE API Key…**
  and **Remove … API Key**. They are kept in your macOS Keychain (service `com.izsk.map`), not in
  Alfred's preferences. The Google key is also written into the local map page in the workflow
  cache, because Google's map needs it in the page.
- **Google key:** in the Google Cloud console, turn on billing and enable *Maps JavaScript API*,
  *Routes API* and *Places API (New)*. Restrict the key to those APIs, not to websites: the map is
  a local page with no web address. Google gives a monthly free allowance per API; beyond it you
  pay Google. Each map redraw (opening, mode or alternative change) is one map load, each route
  lookup is one request per mode, and each typing pause with suggestions is one place search.
  Check Google's current pricing.
- With Google or HERE selected but no key, open data is used and the footer says so. A rejected
  key shows Google's or HERE's own message.
- Google's Routes API takes no stops for transit, so transit with stops is planned leg by leg, as
  with the other providers. Transit times from Google have no delay information.
- FOSSGIS OSRM is asked at most once per second, as its usage policy requires. Alternatives for
  a mode are fetched when you switch to it; with stops, all three modes are fetched.
- Transitous asks heavy users for a contact; set **Contact e-mail** to send it in the
  User-Agent. Nothing else about you is sent.
- Transit with stops is planned leg by leg, each departing after the previous arrival.
- Cache: routes 10 minutes, failed requests 60 seconds, places 7 days, in Alfred's workflow cache.
  Saved places live in Alfred's workflow data folder. Addresses and saved places are marked as
  not exported with the workflow; keys stay in the Keychain.
- Places, stops and route coordinates you search for are sent to the providers above. MapLibre
  is bundled in the workflow, so the map doesn't wait on a CDN.
- Transit with open data exists only where cities publish open timetables (Transitous). Where
  there are none (for example Kolkata), the transit button shows "–" and the footer suggests the
  Google provider, which covers more cities.

If a key or button seems to do nothing, `commands.log` in the workflow's cache folder
(`~/Library/Caches/com.runningwithcrayons.Alfred/Workflow Data/com.izsk.map`) lists the
commands Alfred ran, with field lengths only, never their text.

## Configuration

Keyword (`maps`), Routes and places, Map, Open in (⌘O), default mode, Home and Work addresses,
saved places (`Label = address`, one per line), quick buttons, clipboard destination, language
(automatic, English, Deutsch), Search near, map colours (automatic, dark, light), route line
scale, stop names, font sizes, window width, map height, contact e-mail, Actions and Back
shortcuts and the Node.js path. Times, 12/24-hour clock and units follow macOS. Changes apply
the next time the window opens.

## Development

```sh
bun install --frozen-lockfile
bun run check
bun run package
bun run link
```

The package is `dist/Maps.alfredworkflow`. `ui/window.ts` and `scripts/plist.ts` generate
`ui.json` and `info.plist`. `src/main.ts` is the command-line entry
(`zmap <command> <from> <to> <stop1> <stop2> <stop3> [extra]`), printing one JSON action per run.
Visible actions answer from the cache at once; the `route` command then does the network work
in the background and drops its answer if a newer action happened meanwhile. Map pages are
written to four rotating files so the web view reloads, and a click on an alternative reloads
the page with `?alt=N&t=…`, which the `pick` command handles once per address.

Tests use synthetic places and a mocked network. Releases use `z-map/vX.Y.Z`.

## Credits and AI disclosure

Layout, keys and map behaviour follow the brief for the "Open Maps 1.1.4" Alfred workflow; no
code from it was available or copied. Routing by [Transitous](https://transitous.org) and
[FOSSGIS OSRM](https://routing.openstreetmap.de), places by Transitous and
[Photon](https://photon.komoot.io), map by [OpenFreeMap](https://openfreemap.org) and
[MapLibre GL JS](https://maplibre.org), data © OpenStreetMap contributors. Optional
[Google Maps Platform](https://mapsplatform.google.com) and [HERE](https://www.here.com) services
with your key. See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [LICENSE](LICENSE).

This workflow was built with the help of AI tools. Review it before use and report issues on the
[project tracker](https://github.com/sk-izsk/z-alfred-workflow/issues).
