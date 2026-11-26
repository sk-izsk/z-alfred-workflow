# Dev Cache Cleaner for Alfred 6

Type `devcache` or choose Dev Cache Cleaner in `dev`. Native split view shows caches with sizes/categories/risks and selected path/behavior details. Filter All, Safe, Review, Large > 1 GB or category. Command-K offers selected cleanup review, Open Folder, Copy Path, Copy Cleanup Description, safe-cache review, Scan Again and Configuration.

Scans npm, Yarn, Homebrew, pip, CocoaPods, Composer, pnpm, Xcode DerivedData/Archives, SwiftPM, Gradle, Cargo download cache and Go build cache when those folders exist. Known download/build caches are Safe; shared stores, archives and active build indexes require Review. Xcode Archives can hold irreplaceable signed builds and are never in the Safe bulk action.

Configure semicolon-separated project roots, including external SSD folders. Known build/dependency folder names older than 30 days are offered as Review only. Age is configurable 1–365 days. A folder’s age does not prove it is unused: inspect the project and stop its builds first. Scan depth is limited to six, 2,000 visited folders and 100 candidates. Symlink roots/targets are skipped. Permission/size failures remain visible. Docker volumes, arbitrary app/system caches and project source directories are excluded.

Return opens a **permanent deletion review** listing targets, estimated size and risk notes. Only its explicit Permanently Clean button runs removal. Back cancels the pending plan and restores the results; Escape is disabled in this review. Safe bulk cleanup includes only known Safe caches with a measured nonzero size. Paths, inode/device identities, configured scope and symlink status are revalidated before any removal. Sizes are estimates, not a promise of reclaimed disk space. Cleanup is permanent, not Trash.

Scanning runs only on opening or Scan Again; there is no background polling or automatic cleanup. No real cache was removed for verification. Hyper+B, compact footer and standard screen-aware 780 width follow UI_CONVENTIONS.md. Node.js or Bun required. Development: `bun run check`, `bun run package`, `bun run link`.

Built with help from AI tools. Reference: [Raycast Dev Cache Cleaner](https://github.com/raycast/extensions/tree/e38232e713cc42a58cac81b8d3af9261fd1624e5/extensions/dev-cache-cleaner/). Independent implementation; no external binary or runtime dependency installation.
