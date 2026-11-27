# Background Items

- Independent Bun + TypeScript project; generate UI/plist from source. Preserve `com.izsk.background`.
- Sources: login items (System Events; optional, macOS asks once), `~/Library/LaunchAgents`,
  `/Library/LaunchAgents`, `/Library/LaunchDaemons`. State comes from `launchctl list`,
  `launchctl print system/<label>` and `print-disabled`, all without administrator rights.
- Changing a daemon goes through `do shell script … with administrator privileges`, so macOS shows its
  own password dialog; never handle the password. Labels must match `^[\w.@-]+$` and every argument is
  shell-quoted (`adminShell`).
- ↩ only reveals in Finder. Removing a login item and moving a plist to the Trash ask first; only the
  user's own agents can be trashed, and only to the Trash (recoverable).
- Never stop, disable or remove the user's items to test; tests use synthetic labels.
