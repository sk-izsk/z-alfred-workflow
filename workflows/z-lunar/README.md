# Lunar Controls

Native Alfred 6 controls for the separately installed Lunar app. Open `lunarui` or choose Lunar Controls in Swiss. Search/select a display, then change brightness, contrast or volume with a percentage field, Apply, ±5 buttons or brightness shortcuts (0/25/50/75/100%). Available video inputs come from Lunar's actual display response.

![Native display controls](assets/screenshots/controls.png)

The adaptive picker changes Lunar's global mode: manual (`off`), synced, sun, system, ambient or auto. Saved presets apply the complete named setup across displays. Save New Preset in Actions captures the current setup; existing names are rejected to avoid replacing them accidentally. Actions also offers Power On, reviewed Power Off, Lunar Night Mode, Open Lunar, Refresh and Configuration. Lunar Night Mode is the CLI's warmer-colour mode, not a replacement label for the macOS Night Shift setting.

Requires the current Lunar CLI supporting `displays --json`, `set`, `adaptive` and `preset`. The workflow detects `~/.local/bin/lunar`, Homebrew and common app paths, or accepts a custom executable in Configuration. It never installs Lunar or modifies it. Older/incompatible CLI responses produce an error. Controls unsupported by a display may be rejected by Lunar; unavailable values remain blank and DDC support/control method are shown.

Values refresh on opening, selection, manual Refresh and after a successful change. They do not auto-refresh while you are typing. Numeric commands target the selected display ID; adaptive modes and named presets are global. A change of selected display invalidates an older field action.

The shared width is 780 points with display-aware clamping. Back defaults to Hyper+B with configurable modifier checkboxes and key. Back is visible outside Actions and in sheets; it restores Swiss when launched from there.

```sh
bun install
bun run check
bun run package
bun run link
```

Tests validate response parsing, input limits, argument construction and preset-name parsing. Verification reads the installed app's displays, adaptive state and presets. Tests do not change physical brightness, inputs, power or presets.

Reference: installed Lunar-fred workflow and the installed Lunar CLI's own help. No proprietary binaries, reference code or artwork are redistributed. Original workflow/icon MIT. Built with help from AI tools.
