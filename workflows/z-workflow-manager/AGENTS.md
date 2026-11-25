# Workflow Manager

- Independent Bun + TypeScript project; generate UI and plist from source.
- Read workflow metadata only; never copy secrets, local preferences or configuration into Git.
- Install/update only on explicit UI actions through Alfred's native installer. Preserve user preferences.
- Match Gallery entries by bundle ID. Unknown update sources must remain unknown.
- Removal must address the installed directory entry; never resolve a development symlink to its source.
- Back is visible in every footer/sheet and restores parent state; never put it in Actions.
- Run check/package and use temporary workflow fixtures for removal tests, never installed user workflows.
