# Brew workflow

- Independent Bun + TypeScript project. Generate workflow metadata and UI from scripts/plist.ts and ui/.
- Keep views native and theme-aware. Avoid WebKit or opaque backgrounds; truncate long row text.
- Treat Homebrew metadata as input. Validate package names, taps and operation verbs, then quote commands.
- Mutations require the native review sheet before dispatch to Terminal. Never run real installs,
  upgrades, removals, adoption, services or cleanup during automated verification.
- Test read-only commands in a minimal environment; do not infer successful execution from dispatch.
- Run bun run check and bun run package. Preserve icon credit, MIT notice and AI disclosure.
