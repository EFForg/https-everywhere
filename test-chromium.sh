#!/bin/bash
#
# Build the extension and run a chromium extension with it installed.
#
set -o errexit -o xtrace

source makecrx.sh

# If you just want to run Chromium with the latest code:
if [ "$1" == "--justrun" ]; then
	echo "running Chromium"
	source utils/mktemp.sh

	PROFILE_DIRECTORY="$(mktemp -d)"
	trap 'rm -r "$PROFILE_DIRECTORY"' EXIT
	chromium-browser \
		--user-data-dir="$PROFILE_DIRECTORY" \
		--load-extension=pkg/crx/
else
	echo "running tests"
	python test/chrome/script.py pkg/
fi
