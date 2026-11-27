# Launchpad

- Independent Bun + TypeScript project; generate UI/plist from source. Preserve `com.izsk.launchpad`.
- The grid is a local web page (`src/page.ts`) because Alfred UI has no scroll, swipe or drag events.
  It loads nothing remote (CSP: no network). Changes come back as `?op=…&s=<layout>` navigations,
  read by `nav`; every layout from the page goes through `validLayout` before it is saved.
- Keep the original workflow's behaviour (keyboard, search matching, cheat sheet, default order).
  Its saved order is read once for import and never written.
- Tests use synthetic paths; never touch the real layout or the original's Persist file in tests.
