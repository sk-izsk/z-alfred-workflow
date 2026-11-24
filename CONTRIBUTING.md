# Contributing

Branch from `dev` and open a pull request back into `dev`. Keep changes scoped to the workflow
being updated, unless they concern repository infrastructure.

## Work on a workflow

From `workflows/<name>`, run `bun install --frozen-lockfile`, `bun run check` and `bun run package`.
Follow that workflow's contribution guide and any `AGENTS.md` instructions. Edit TypeScript
sources rather than generated `ui.json` or `info.plist`, then rebuild. Generated files already
tracked by the workflow should be committed with their source changes.

Try affected commands in Alfred before releasing; CI cannot verify the on-screen experience.
Include the workflow name, behavior change and validation in the PR description. Do not commit
local preferences, credentials, vault data, build bundles or dependency folders.

## Add a workflow

1. Create `workflows/<name>/` as ordinary files in this Git repository, without a nested `.git`.
2. Include a README with installation, requirements, usage and development commands; a license;
   and third-party notices where needed.
3. Keep its dependencies, lockfile, tests, scripts and version within that folder. Provide
   `bun run check` and `bun run package`, producing `dist/*.alfredworkflow` without preferences.
4. Add it to the root README, CI matrix and release workflow's tag mapping and tag triggers.
5. Document its artifact name and namespaced tag in `RELEASING.md`.

Read [SECURITY.md](SECURITY.md) before reporting security issues and
[RELEASING.md](RELEASING.md) before publishing packages.
