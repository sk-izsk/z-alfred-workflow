# Calculate Anything bridge

- Independent Bun + TypeScript workflow, com.izsk.calculate-anything; generate UI/plist.
- Reuse the installed com.alfred.calculateanything engine. Never modify its preferences or shortcuts.
- Pass queries through stdin, not shell/PHP source interpolation. Keys only enter the child environment.
- Use separate data/cache paths for engine execution. Never install software/dependencies at runtime.
- Arithmetic parser is bounded and never evals input. Preserve upstream copy variants; reject invalid rows.
- Back stays visible outside Actions. Keep missing-engine/PHP/vendor errors explicit.
- Preserve MIT icon credits and AI disclosure. Tests use a temporary fake engine, not user settings.
