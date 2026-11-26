# World Clock

- Independent Bun + TypeScript workflow; preserve com.izsk.world-clock and generate UI/plist.
- All times/offsets use Intl and IANA timezone names for the same instant. Never store a fixed offset.
- No menubar, network lookups, runtime dependency installs or external location requests.
- Native list/grid and transparent generated clock PNGs; no web view or hardcoded panel background.
- Typing/timer updates change data, never rebuild/refocus the search field. Register shortcuts statically.
- Preserve starred IDs, aliases, memos, ordering and duplicate zones with independent IDs.
- Back is visible outside Actions in every footer; sheets return to their parent; root restores Swiss when applicable.
- Preserve Raycast MIT icon attribution and public-domain IANA metadata notice. Run check/package/UI checker.
- Tests use synthetic instants and temporary data/cache directories. Never commit user stars or avatars.
