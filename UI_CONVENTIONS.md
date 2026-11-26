# Workflow window and shortcut conventions

Use the Bitwarden window as the reference: **780 points wide** at normal desktop sizes. Do not make a workflow wider simply because it has a calendar or two columns. Heights should suit the content; overflowing text and lists scroll. Use flexible centre regions, truncation/tooltips and smaller internal constraints so content fits the window. Clamp the initial width to the active display's available width minus 40 points. Avoid minimum widths that prevent this. Check small displays and external windows as well as Alfred's embedded presentation.

`shared/ui-profile.ts` supplies the width, display-aware launch sizing, Back configuration and compact shortcut labels. Bun bundles it into each independent workflow; installed workflows do not depend on another workflow being installed. The screen probe has a bounded timeout and falls back to 780 when display information is unavailable.

Back defaults to **Hyper+B**: Control + Option + Shift + Command + B. Expose an enabled-by-default Hyper checkbox, one checkbox for each modifier (all enabled by default), and a Back key field (B). When Hyper is disabled, use the custom Back shortcut field. These are native Configuration Builder fields; the modifier fields remain visible when disabled, but do not apply. Never use a bare letter as a global Back shortcut because it consumes search input.

The footer shows **Back Hyper+B**, not all four modifier symbols. Use `shortcutLabel()` for any footer shortcut containing all four modifiers; partial combinations retain their actual symbols. Labels and keyboard bindings must resolve from the same settings. Keep Actions configurable, normally Command-K. Back stays visibly outside Actions in every view and sheet and returns one navigation level, restoring search, selection and other view state. The first level returns to its calling workflow/menu or Alfred search.

Apply this convention to Folder Navigator and each new workflow now. After the requested feature phases, migrate existing workflows together. Preserve explicit user preferences; a changed default must not silently replace a user's chosen shortcut. Generate UI JSON and plist from TypeScript, then check/package and verify the actual footer and key binding in Alfred.

Window property reference: [Alfred UI window documentation](https://www.alfredapp.com/help/alfredui/window/). Alfred's embedded width otherwise follows the theme; use the documented window resize action to apply the shared width on launch.

Generation uses `profileWindow(ui, cli)` and `profileInfo(infoPlist)`. CLI entry points call `await profileCommand(() => import("./env.ts"))` before dispatch. The launch profile updates only component IDs present in the initial view. Runtime views resolve `backBinding()` and `shortcutLabel()` from the same settings. Existing custom Back shortcuts remain active until the user explicitly configures Hyper. All 22 existing workflow projects have been migrated and checked.

## Screenshot fidelity

User-provided screenshots define the required layout and interactions for every workflow: preserve hierarchy, section grouping, summary rows, list versus split-detail arrangement, controls, density and Actions items. Do not replace a supplied design with a generic dashboard. Adapt only Alfred theme, documented platform constraints and the shared width/Back conventions. Check the actual native window against its reference before calling the UI complete; record any unverified differences.

## Native controls before web views

Use native Alfred components for lists, groups, value badges, forms, error states and navigation. A CLI backend is not a reason to add a web view. Keep web views only for a concrete capability/design requirement unsupported by the native components, and record that reason. Current exceptions: Lunar sliders (no native slider control), Speed Test gauge/sparkline charts, VS Code rich HTML extension README previews, and animated GIF detail previews. GIF search/results, weather and ordinary status/error lists remain native.
