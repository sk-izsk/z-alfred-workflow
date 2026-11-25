# Releasing a workflow

Versions belong to individual workflows. Use these tag names in this repository:

| Project folder | Tag | Release asset |
| --- | --- | --- |
| `workflows/z-bitwarden` | `z-bitwarden/vX.Y.Z` | `Bitwarden.alfredworkflow` |
| `workflows/z-vscode` | `z-vscode/vX.Y.Z` | `VS Code.alfredworkflow` |
| `workflows/z-cald` | `z-cald/vX.Y.Z` | `Calendar.alfredworkflow` |
| `workflows/z-brew` | `z-brew/vX.Y.Z` | `Brew.alfredworkflow` |
| `workflows/z-speedtest` | `z-speedtest/vX.Y.Z` | `Speed Test.alfredworkflow` |
| `workflows/z-github` | `z-github/vX.Y.Z` | `GitHub.alfredworkflow` |
| `workflows/z-kill-process` | `z-kill-process/vX.Y.Z` | `Kill Process.alfredworkflow` |
| `workflows/z-adhan-time` | `z-adhan-time/vX.Y.Z` | `Adhan Time.alfredworkflow` |
| `workflows/z-currency` | `z-currency/vX.Y.Z` | `Currency Exchange.alfredworkflow` |
| `workflows/z-calculate-anything` | `z-calculate-anything/vX.Y.Z` | `Calculate Anything.alfredworkflow` |
| `workflows/z-weather` | `z-weather/vX.Y.Z` | `Weather.alfredworkflow` |

1. Bump `version` in the selected workflow's `package.json`.
2. In that folder, run `bun install --frozen-lockfile`, `bun run check` and `bun run package`.
3. Inspect `dist/*.alfredworkflow` with `unzip -l`; verify it contains the runtime bundle, license
   and notices, with no `prefs.plist`, secrets or development files. Try it in Alfred.
4. Commit the version and rebuilt tracked files, open a PR into `dev`, and merge after checks pass.
5. From the repository root, tag the merged commit and push only that tag. For example:

```bash
git switch dev
git pull --ff-only origin dev
git tag z-bitwarden/v1.0.1
git push origin z-bitwarden/v1.0.1
```

The release action checks that the tag version matches `package.json`, checks and packages only
that workflow, then creates its GitHub release with the asset and generated notes. Workflows can
have different versions. Do not push the original `v*` tags to this repository.
Do not reuse an already published version just to migrate it; historical downloads remain at
the links in the root README. Publishing requires GitHub Actions to have write access to contents.
