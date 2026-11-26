# Verification

Five tests / 28 assertions cover command allowlists, dry-run flags, status parsing, grouped summaries and sizes, native layouts without web views, folder Back path/query/selection and blocking execution before a successful preview. Dynamic UI validation passed for all five modes: menu, status, clean, optimize and analyze (zero errors/warnings).

Live read-only status and cleanup/optimization previews were parsed. No actual cleanup or optimization was run. Automated native screenshots lost Alfred focus; final screenshot comparison remains pending. Mole no longer ships an embedded web view or HTML/JavaScript renderer, so the empty white web panel is removed rather than hidden.
