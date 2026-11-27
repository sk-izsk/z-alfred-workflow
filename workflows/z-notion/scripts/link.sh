#!/bin/zsh --no-rcs
# Symlink workflow/ into Alfred's preferences for development, then reload it.
set -e
root=${0:A:h:h}
prefs=$(defaults read com.runningwithcrayons.Alfred-Preferences syncfolder 2>/dev/null || echo "~/Library/Application Support/Alfred")
prefs=${~prefs}/Alfred.alfredpreferences/workflows
ln -sfn "$root/workflow" "$prefs/user.workflow.izsk-notion"
loaded=0
for attempt in 1 2 3 4 5; do
  if /usr/bin/osascript -e 'tell application id "com.runningwithcrayons.Alfred" to reload workflow "user.workflow.izsk-notion"' 2>/dev/null; then
    loaded=1
    break
  fi
  /bin/sleep 0.2
done
[[ $loaded == 1 ]] || { print -u2 "Alfred has not indexed the new workflow yet. Run bun run link again."; exit 1; }
echo "Linked $root/workflow → $prefs/user.workflow.izsk-notion"
