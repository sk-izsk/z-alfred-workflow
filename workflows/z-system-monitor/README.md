# System Monitor

Live native Alfred 6 overview of system, CPU, memory, mounted disks, power and network activity. Open `sysmon`, or select System Monitor in Swiss. Each section has a list on the left and scrollable details on the right.

CPU percentages and network rates use successive counter samples; the first sample shows Measuring. Network includes interface rates and the five busiest processes when macOS nettop permits access. Memory shows physical allocation (including caches), VM categories, swap and top processes. Disks include mounted external drives and root filesystem/protocol/SMART metadata. Power shows the reported source, battery status and available capacity/cycle fields.

Refresh runs while the window is open, every 5 seconds by default (2–60 seconds in Workflow Configuration). Actions offers Pause/Resume, Refresh, Copy Section, Open Activity Monitor and Configuration. Return opens Activity Monitor. No monitoring daemon or runtime dependency installation is used.

Temperature/fan sensors are not exposed through these standard tools; the CPU section says so explicitly. Unsupported battery/disk/permission-protected fields show Unavailable. Process CPU from ps uses its own measurement interval, while total/per-core CPU uses counter deltas. These measurements should not be expected to match Activity Monitor at every instant.

The shared width is 780 points, clamped to the active display. Back defaults to Hyper+B, with a Hyper toggle, four modifier checkboxes and a custom Back field. Back is visible outside Actions. When launched from Swiss it restores that search and selection.

![Native overview](assets/screenshots/overview.png)

## Build

```sh
bun install
bun run check
bun run package
bun run link
```

References: [Raycast System Monitor](https://github.com/raycast/extensions/tree/86a5e3dc08b9e9c30a9ef9c78228701ef375f3d6/extensions/system-monitor/) and the locally installed atop workflow. No source or artwork was copied. MIT. Built with help from AI tools.

Shared UI: windows use the 780-point reference width with active-display clamping. Back defaults to Hyper+B (Control + Option + Shift + Command + B); Configuration includes the Hyper toggle, four modifier checkboxes, Back key and custom shortcut. Footer labels use Hyper+B. Existing explicit custom Back shortcuts remain active until Hyper configuration is explicitly saved.

The native reference layout groups the sidebar by metric section and shows current usage badges on the right. Detail values align on the right, with percent badges and per-core/top-process headings.
