# Third-party notices

No third-party code is bundled. The map page loads these at runtime from public CDNs and services:

- **MapLibre GL JS 5** (BSD-3-Clause), from unpkg.com, with jsDelivr as fallback. © MapLibre contributors.
- **OpenFreeMap** map styles and tiles. Map data © OpenStreetMap contributors (ODbL); tiles from
  OpenMapTiles. The attribution is shown on the map.
- **Transitous** (MOTIS) routing and place search, an open community service: <https://transitous.org>.
- **FOSSGIS OSRM** routing (routing.openstreetmap.de), limited to one request per second.
- **Photon** by Komoot, place search fallback.
- **Google Maps Platform** (Maps JavaScript API, Routes API, Places API (New)), only when you
  enter your own Google API key. Use is subject to Google's terms; the Google map keeps its logo
  and terms link.
- **HERE** Geocoding, Routing, Public Transit and Map Tile APIs, only when you enter your own HERE
  API key. Use is subject to HERE's terms.

The layout, keys, palettes and map behaviour follow the brief for the "Open Maps 1.1.4" Alfred
workflow. No code from that workflow was available or copied; this is an independent TypeScript
implementation. The icon is drawn from Apple's SF Symbol "map.fill" for use on Apple platforms.
