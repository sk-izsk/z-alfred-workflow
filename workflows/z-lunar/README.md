# Lunar Controls

Native Alfred 6 controls for the separately installed Lunar app. Open `lunarui` or choose Lunar Controls in Swiss. Search/select a display, then change brightness, contrast or volume with sliders and live numeric labels, or brightness shortcuts (0/25/50/75/100%). Hardware changes apply when you release the slider; dragging updates the label immediately. Clicking a display only selects it and never opens the Lunar app. Available video inputs come from Lunar's actual display response.

![Native display controls](assets/screenshots/controls.png)

Rounded selector controls provide video input, adaptive mode and saved presets. The adaptive picker changes Lunar's global mode: manual (`off`), synced, sun, system, ambient or auto. Saved presets apply the complete named setup across displays. Save New Preset in Actions captures the current setup; existing names are rejected to avoid replacing them accidentally. Actions also offers Power On, reviewed Power Off, Lunar Night Mode, Open Lunar, Refresh and Configuration. Lunar Night Mode is the CLI's warmer-colour mode, not a replacement label for the macOS Night Shift setting.

Requires the current Lunar CLI supporting `displays --json`, `set`, `adaptive` and `preset`. The workflow detects `~/.local/bin/lunar`, Homebrew and common app paths, or accepts a custom executable in Configuration. It never installs Lunar or modifies it. Older/incompatible CLI responses produce an error. Controls unsupported by a display may be rejected by Lunar; unavailable values remain blank and DDC support/control method are shown.

Values refresh on opening, selection, manual Refresh and after a successful change. They do not auto-refresh while you are dragging. Numeric commands target the selected display ID; adaptive modes and named presets are global. A change of selected display invalidates an older field action.

The shared width is 780 points with display-aware clamping. Back defaults to Hyper+B with configurable modifier checkboxes and key. Back is visible outside Actions and in sheets; it restores Swiss when launched from there.

```sh
bun install
bun run check
bun run package
bun run link
```

Tests validate response parsing, input limits, argument construction and preset-name parsing. Verification reads the installed app's displays, adaptive state and presets. Tests do not change physical brightness, inputs, power or presets.

Reference: installed Lunar-fred workflow and the installed Lunar CLI's own help. No proprietary binaries, reference code or artwork are redistributed. Original workflow/icon MIT. Built with help from AI tools.

The slider/selector panel runs locally inside Alfred’s embedded WebKit view; it makes no remote page requests. Back and Actions shortcuts are also handled when this panel has keyboard focus.

Shared UI: windows use the 780-point reference width with active-display clamping. Back defaults to Hyper+B (Control + Option + Shift + Command + B); Configuration includes the Hyper toggle, four modifier checkboxes, Back key and custom shortcut. Footer labels use Hyper+B. Existing explicit custom Back shortcuts remain active until Hyper configuration is explicitly saved.
