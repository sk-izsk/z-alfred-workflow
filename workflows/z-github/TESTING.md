# Verification

`bun run check` runs TypeScript, lint, formatting and mocked-CLI tests. Tests use temporary files,
fake GitHub responses and disposable Git repositories. They do not create or modify GitHub objects,
move a real repository to Trash, or change any real checkout.

Coverage includes full-history My PR queries, repository/relation/status filters, API cache behavior,
list pagination, all creation forms, per-repository My PR actions, merge head-SHA matching, Back
exit routing, stale-request protection, remote normalization, local scanning and guarded
removal. Source icons and runtime files are included by `bun run package`.

Additional checks:

```sh
python3 /path/to/alfred-ui/scripts/check_ui.py workflow
plutil -lint workflow/info.plist
unzip -l dist/GitHub.alfredworkflow
```

A read-only bare-environment check with the maintainer’s existing GitHub CLI login loaded 50 PRs
with the All status filter. Demo-only source-generated screens were rendered in Alfred for README
screenshots; they contain no real account or repository details. These screenshots establish layout,
not successful execution of every action.

Before release, check in Alfred:

- Main menu, myprs/gitrepos aliases, configured keywords and optional hotkey.
- Search, repository/relation/status filters, Load More and refresh.
- ⌘K → My Pull Requests on remote and local GitHub repositories.
- Use Back from lists, form pages and sheets; return to the main Alfred search.
- PR/issue detail, diff/commits and metadata actions with appropriate account permissions.
- Creation forms and advanced pages; create disposable test objects only when intended.
- Workflow dispatch inputs and rerun/cancel/delete on disposable runs.
- Notification, discussion, project and package permissions and error messages.
- Local favorites, application opening, clone destinations, ZIP/directory downloads and quicklinks.
- Safe/force removal on disposable repositories only.

Write actions are implemented but have not been exercised against production GitHub data. Clipboard,
application dispatch, all forms and back-key behavior still require interactive confirmation.
