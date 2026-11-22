#!/bin/zsh --no-rcs
# Zip workflow/ into dist/Bitwarden.alfredworkflow (prefs.plist and dev files excluded).
set -e
root=${0:A:h:h}
mkdir -p "$root/dist"
out="$root/dist/Bitwarden.alfredworkflow"
rm -f "$out"
cd "$root/workflow"
zip -qr "$out" . -x "prefs.plist" -x ".DS_Store" -x "*/.DS_Store" -x ".omc/*" -x "*/.omc/*" -x "bin/bwa-enclave"
echo "Built $out ($(du -h "$out" | cut -f1))"
