// Mounted volumes from NSFileManager, from JXA (one call, ~40 ms).
//   osascript -l JavaScript volumes.js   → JSON list of volumes with capacity and kind flags
ObjC.import("Foundation");
const KEYS = [
  "NSURLVolumeNameKey",
  "NSURLVolumeTotalCapacityKey",
  "NSURLVolumeAvailableCapacityForImportantUsageKey",
  "NSURLVolumeAvailableCapacityKey",
  "NSURLVolumeIsEjectableKey",
  "NSURLVolumeIsRemovableKey",
  "NSURLVolumeIsInternalKey",
  "NSURLVolumeIsLocalKey",
  "NSURLVolumeIsRootFileSystemKey",
  "NSURLVolumeLocalizedFormatDescriptionKey",
  "NSURLVolumeIsReadOnlyKey",
];
const SKIP_HIDDEN = 1 << 1;
const value = (values, key) => {
  const v = values.objectForKey(key);
  return v && !v.isNil() ? ObjC.unwrap(v) : null;
};
function run() {
  try {
    const urls = $.NSFileManager.defaultManager.mountedVolumeURLsIncludingResourceValuesForKeysOptions(
      $(KEYS),
      SKIP_HIDDEN,
    );
    const volumes = [];
    for (let i = 0; i < urls.count; i++) {
      const url = urls.objectAtIndex(i);
      const v = url.resourceValuesForKeysError($(KEYS), null);
      volumes.push({
        path: ObjC.unwrap(url.path),
        name: value(v, "NSURLVolumeNameKey") || ObjC.unwrap(url.lastPathComponent),
        total: value(v, "NSURLVolumeTotalCapacityKey") || 0,
        // "Important usage" counts purgeable space as free, like Finder.
        free: value(v, "NSURLVolumeAvailableCapacityForImportantUsageKey") || value(v, "NSURLVolumeAvailableCapacityKey") || 0,
        ejectable: value(v, "NSURLVolumeIsEjectableKey") === true,
        removable: value(v, "NSURLVolumeIsRemovableKey") === true,
        internal: value(v, "NSURLVolumeIsInternalKey") === true,
        local: value(v, "NSURLVolumeIsLocalKey") !== false,
        root: value(v, "NSURLVolumeIsRootFileSystemKey") === true,
        readOnly: value(v, "NSURLVolumeIsReadOnlyKey") === true,
        format: value(v, "NSURLVolumeLocalizedFormatDescriptionKey") || "",
      });
    }
    return JSON.stringify(volumes);
  } catch (error) {
    return JSON.stringify({ error: String(error && error.message ? error.message : error) });
  }
}
