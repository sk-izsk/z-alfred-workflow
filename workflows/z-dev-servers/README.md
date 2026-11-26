# Dev Servers for Alfred 6

Type `devservers` or choose Dev Servers in `dev`. Finds TCP listeners owned by recognized development runtimes, sorted by project, with a framework filter, localhost URL, PID and project directory. Search projects, tools and ports. Refresh defaults to five seconds while open; change 2–60 seconds in Workflow Configuration, or pause/resume in Command-K.

Return opens the localhost URL. Command-K offers Stop Server, Copy URL, Restart Server, Open in Terminal, Show in Finder, Stop All for Project, Refresh, Pause/Resume, Stop All Listed Servers and Configuration. Stop sends SIGTERM directly, after rechecking PID, start time, command, directory and listening port. Stop-project uses the displayed directory; bulk operations never expand the saved snapshot to newly appearing processes. Restricted or inaccessible processes may be absent. This is a development-runtime listener list, not every system service.

Restart looks for a declared dev/start/develop package.json script and detects npm, pnpm, Yarn or Bun from lockfiles. It validates the plan before stopping, then starts it in Terminal, preserving interactive authentication and output. Non-JavaScript servers can be inspected/stopped, but must be started again in their original terminal. No dependency installation, auto-start at login or menubar feature is included. No real user server was stopped for testing.

Back defaults to configurable Hyper+B and restores the Dev launcher’s search/selection. Standard width 780 and screen-aware sizing follow UI_CONVENTIONS.md. Independent workflow; Node.js or Bun required. Build: `bun run check`, `bun run package`; local installation: `bun run link`.

Built with help from AI tools. Reference: [Raycast Dev Servers](https://github.com/raycast/extensions/tree/18750b5bc7fe87eb76991e86f0cda47200daa48f/extensions/dev-servers/). The implementation uses system ps/lsof inspection and does not bundle Raycast code or binaries.

Terminal actions use **Terminal application** in Workflow Configuration: Ghostty, Terminal, iTerm2, kitty, WezTerm, Alacritty or a custom executable. Ghostty uses its native AppleScript API (verified with installed Ghostty 1.4); macOS may request Automation permission. Custom arguments are a JSON array with `{command}` and `{cwd}` placeholders. Existing explicit terminal choices are preserved. No terminal is installed automatically.

Server rows are grouped by project directory with counts, localhost ports, measured process uptime and framework badges. Heading rows cannot trap keyboard selection. Stop All Listed Servers affects the current visible/filter results; Stop All for Project covers the selected project.
