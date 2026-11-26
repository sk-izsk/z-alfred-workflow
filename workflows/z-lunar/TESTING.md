# Verification

Check, package and UI checker pass. Tests cover numeric command limits, metadata parsing, local-only slider/selector events, HTML escaping and display-row selection wiring.

Native verification: clicking MSI MP251 selects it and updates the control panel without opening Lunar. Sliders, live labels and rounded selectors render in Alfred; Command-K opens Actions while the embedded panel has focus. The screenshot uses the actual connected displays. No deliberate brightness, input, volume or power changes were made to verify hardware writes; those commands remain covered by argument validation and the installed CLI's documented syntax.
