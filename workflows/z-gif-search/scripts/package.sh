#!/bin/zsh --no-rcs
# Zip workflow/ into dist/GIF Search.alfredworkflow (your prefs.plist and dev files excluded).
set -e
root=${0:A:h:h}
mkdir -p "$root/dist"
out="$root/dist/GIF Search.alfredworkflow"
rm -f "$out"
cd "$root/workflow"
zip -qr "$out" . -x "prefs.plist" -x ".DS_Store" -x "*/.DS_Store" -x ".omc/*" -x "*/.omc/*"
# Include the license and source/provider notices.
cd "$root" && zip -q "$out" LICENSE THIRD_PARTY_NOTICES.md
echo "Built $out ($(du -h "$out" | cut -f1))"
