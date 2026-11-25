# Verification

Four tests cover registry uniqueness/minimum versions, launch envelope shape, search and selection
persistence, handoff without execution, missing-tool rejection and Back outside Actions. Each of the
six participating tools has direct-versus-Swiss parser/Back tests. Existing internal-history tests
remain in place, including Weather's list/report state and Speed Test's meter/detail navigation.

Run check/package, UI checker and XML plist validation for Swiss and all six affected workflows.
Inspect archives for preferences, caches and dependencies; all copied icons need bundled notices.

Live targeted native-button checks passed for Swiss → Weather Cities → Report → Back → Cities → Back → Swiss, restoring the launcher query and selection. Adhan → root Back → Swiss and Swiss → Back → Alfred search also passed.

Before release, exercise the same path for the other tools. Confirm the
launcher search/selection restore, and direct tool launches still return to main search. Check missing
and older installations, configurable shortcuts and theme changes. Opening Swiss must not run a speed
test, process sampler, weather/rates request or original PHP engine.
