# Maps

- Independent Bun + TypeScript project; generate UI/plist and preserve `com.izsk.map`.
- The window is deliberately 1180 × 620 (configurable, screen-clamped): `scripts/build-workflow.ts`
  undoes the shared 780 clamp after `profileWindow`. Keep the map a webkitview; everything else native.
- Only `update` text fields; replace the parts around them (`viaSlot`, `rest`, `mapBox`) with the
  same `grid`/`region` constraints as in `ui/window.ts` (tested).
- Visible commands answer from the cache and set `needsRoute`; only `route` (async) touches the
  network and drops stale answers by token. Map pages rotate through `map-0…3.html`; alternative
  clicks arrive as `?alt=N&t=…` through `pick`.
- Providers (`open.ts`, `google.ts`, `here.ts`) share `search(query, ctx, limit)` and return the
  model in `model.ts`. Google's key goes only in request headers and the Maps script URL, never in
  the page data. Suggestions run on `typingstopped` and drop late answers by `suggestStarted`.
- Respect FOSSGIS OSRM's one request per second and send the configured contact to Transitous.
- Tests use synthetic places and a mocked fetch. Never commit real addresses, saved places, HERE
  keys or caches. Keep the AI disclosure and notices. Run check, package and the Alfred UI checker.
