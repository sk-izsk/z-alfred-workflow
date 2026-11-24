# Migration record

Imported on November 24, 2026:

| Destination | Original repository | Imported `dev` commit |
| --- | --- | --- |
| `workflows/z-bitwarden` | [sk-izsk/z-bitwarden](https://github.com/sk-izsk/z-bitwarden) | `47ebff4e22160f9f36d080d66625525b1d3eeb12` |
| `workflows/z-vscode` | [sk-izsk/z-vscode-workflow](https://github.com/sk-izsk/z-vscode-workflow) | `60ee161cc987b39e6f23c25cfb3c170613f84c3d` |

The supplied local checkouts were clean. VS Code's checkout was three commits behind GitHub;
the import uses GitHub's latest `dev`, which includes those commits. Each import merge keeps
its original parent history and places its tree under `workflows/`. Earlier history uses the
original root paths; browse the import's second parent to inspect it. Use a normal full clone
when you need the complete history.

The original directories and GitHub repositories remain intact. Their existing releases and
assets remain available there. Legacy `v*` tags are not published into the new remote; future
tags are namespaced per workflow. GitHub issues, PR discussions, release assets and repository
settings are not part of Git history and have not been migrated.

## Cutover after merging the migration PR

- Use this repository for future changes and releases.
- Run `bun install --frozen-lockfile` and `bun run link` inside each migrated workflow if Alfred
  currently points at its old development directory. Rebuild and confirm it opens in Alfred.
- Keep old directories until you have verified any ignored local notes or settings you want to
  retain. Those machine-specific files were deliberately not imported.
- Update external installation links when the first centralized release is published. Optionally
  mark the original repositories as moved after the cutover is verified.
