# Verification

Automated checks cover folder/package/link classification, dotfiles, directory filtering/sorting, literal paths, Spotlight predicate escaping and bounds, complete multi-level Back restoration, stale-view event rejection, stale search rejection, missing folders, menu actions, native IDs and the Swiss launch protocol.

The real Spotlight query was checked against the repository directory on the indexed external volume. `kMDItemFSInvisible` is readable with mdls but is not a usable search-index predicate on this macOS build; hidden dot-path filtering is done after search instead.

Native UI testing uses disposable `/private/tmp/Folder Navigator Demo` files. Desktop automation is affected by Alfred losing activation to the foreground application, so distinguish capture/focus issues from the backend/navigation checks. Confirm actual folder descent and Back before marking native verification complete. Do not open a user file or run an installed integration merely for a screenshot.

Native verification completed with a fresh session (use Alfred `search ""` before the external trigger; repeated triggers can reuse an existing UI session). A disposable demo directory opens with native folder/file icons, and the visible Hyper+B Back button restores the prior full-path query and selected folder. Screenshots show those two views. The mounted starting list was also checked against the actual external SSD. Physical Hyper-key delivery and opening user files were not exercised by automation.
