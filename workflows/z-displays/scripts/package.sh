#!/bin/zsh --no-rcs
# Zip workflow/ into dist/Displays.alfredworkflow (your prefs.plist and dev files excluded).
set -e
root=${0:A:h:h}
mkdir -p "$root/dist"
out="$root/dist/Displays.alfredworkflow"
rm -f "$out"
cd "$root/workflow"
zip -qr "$out" . -x "prefs.plist" -x ".DS_Store" -x "*/.DS_Store" -x ".omc/*" -x "*/.omc/*"
# License and notices travel with the archive.
cd "$root" && zip -q "$out" LICENSE THIRD_PARTY_NOTICES.md
echo "Built $out ($(du -h "$out" | cut -f1))"
