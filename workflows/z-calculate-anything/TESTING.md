# Verification

Five main tests plus two Swiss navigation tests check upstream result/copy normalization, rejected nonactionable rows, local arithmetic,
division errors, configured engine discovery, query transport through stdin, blank input and query
limits. Typing updates are checked to preserve the existing input field and cursor. The fake PHP engine and data/cache directories are temporary; tests do not use user settings.

Real local engine checks passed for 100 km in miles, 2 GB in MB, 100 + 16%, and time now plus 6 hours.
The installed original 4.0.7 workflow lacked vendor/; only that missing directory was restored from the
matching official 4.0.7 release. Its settings, identifiers, workflow files and shortcuts were preserved.
No dependency repair is performed by the shipped workflow.

Run check/package, UI checker, plist validation, bare-environment launcher and inspect the archive.
Local Alfred capture verifies the native result list and footer. Before release, check keyboard focus,
selection/copy variants, Swiss Back, custom shortcuts, missing engine/PHP errors and themes. Live
currency/crypto providers are not verified without their credentials.
