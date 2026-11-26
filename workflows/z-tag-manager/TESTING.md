# Verification

`bun run check`, `bun run package`, UI checker (0 errors/0 warnings) and generated plist lint pass.

Disposable temporary files verify binary Finder metadata round trips, preservation of tag colours and unrelated xattrs, symlink rejection, import validation, cache freshness and Back state restoration. No personal files were tagged.

Native Alfred verification: direct file launch opens its tag editor at 780 points with Hyper+B in the footer. Existing tags render correctly and the separate native Actions popup includes file actions, export/import and configuration. Screenshots use only a disposable demo document. Physical Hyper-key delivery and a bulk import through the real clipboard were not exercised.

System-wide discovery regression: the previous `~;/Volumes` default excluded `/Applications`. The new default queries Spotlight globally, versions the cache by query/scope, and filters before the result limit. A live read-only `paid` search found 29 entries carrying Paid, with no unavailable paths and no truncation. All file metadata was left unchanged.
