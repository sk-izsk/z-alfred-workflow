# Workflow window and shortcut conventions

Use the Bitwarden window as the reference: **780 points wide** at normal desktop sizes. Do not make a workflow wider simply because it has a calendar or two columns. Heights should suit the content; overflowing text and lists scroll. Use flexible centre regions, truncation/tooltips and smaller internal constraints so content fits the window. Clamp the initial width to the active display's available width minus 40 points. Avoid minimum widths that prevent this. Check small displays and external windows as well as Alfred's embedded presentation.

`shared/ui-profile.ts` supplies the width, display-aware launch sizing, Back configuration and compact shortcut labels. Bun bundles it into each independent workflow; installed workflows do not depend on another workflow being installed. The screen probe has a bounded timeout and falls back to 780 when display information is unavailable.

Back defaults to **Hyper+B**: Control + Option + Shift + Command + B. Expose an enabled-by-default Hyper checkbox, one checkbox for each modifier (all enabled by default), and a Back key field (B). When Hyper is disabled, use the custom Back shortcut field. These are native Configuration Builder fields; the modifier fields remain visible when disabled, but do not apply. Never use a bare letter as a global Back shortcut because it consumes search input.

The footer shows **Back Hyper+B**, not all four modifier symbols. Use `shortcutLabel()` for any footer shortcut containing all four modifiers; partial combinations retain their actual symbols. Labels and keyboard bindings must resolve from the same settings. Keep Actions configurable, normally Command-K. Back stays visibly outside Actions in every view and sheet and returns one navigation level, restoring search, selection and other view state. The first level returns to its calling workflow/menu or Alfred search.

Apply this convention to Folder Navigator and each new workflow now. After the requested feature phases, migrate existing workflows together. Preserve explicit user preferences; a changed default must not silently replace a user's chosen shortcut. Generate UI JSON and plist from TypeScript, then check/package and verify the actual footer and key binding in Alfred.

Window property reference: [Alfred UI window documentation](https://www.alfredapp.com/help/alfredui/window/). Alfred's embedded width otherwise follows the theme; use the documented window resize action to apply the shared width on launch.
