# Verification

Automated tests use a fake Ookla CLI and private temporary sessions. They cover meter → detailed list → detail toggle → Back, selection/query restoration, root exit, fresh history on restart, one Back binding per screen, and sheet return without closing the parent. Tests check that live frames update without replacing the animated HTML document, respect reduced motion, and escape CLI data.

All workflow checks, packages, Alfred UI schema checks and plist validation must pass.

On 2026-11-24, the installed Alfred workflow was launched with the real Ookla CLI. Screenshots verified the visible live meter, Enter opening details, and Command-[ restoring the meter while the same test continued. Native WebKit verification with synthetic data recorded intermediate values between 10 and 500 Mbps in the same document. These captures remain outside the repository because the live test contains private connection details.

Before release, also check repeated Back from nested views, footer clicks, custom Back shortcuts, starting a fresh test after closing in list mode, and reduced-motion behavior on screen. Back remains outside the Actions menu.
