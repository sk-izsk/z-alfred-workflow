#!/bin/zsh --no-rcs
# Symlink workflow/ into Alfred's preferences for development, then reload it.
set -e
root=${0:A:h:h}
prefs=$(defaults read com.runningwithcrayons.Alfred-Preferences syncfolder 2>/dev/null || echo "~/Library/Application Support/Alfred")
prefs=${~prefs}/Alfred.alfredpreferences/workflows
ln -sfn "$root/workflow" "$prefs/user.workflow.izsk-speedtest"
osascript -e 'tell application id "com.runningwithcrayons.Alfred" to reload workflow "user.workflow.izsk-speedtest"'
echo "Linked $root/workflow → $prefs/user.workflow.izsk-speedtest"
