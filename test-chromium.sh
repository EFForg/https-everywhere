#!/bin/bash
#
# Build the extension and run a chromium extension with it installed.
#
set -o errexit -o xtrace

# If you just want to run Chromium with the latest code:
if [ "$1" == "--justrun" ]; then
	shift
	source makecrx.sh
	echo "running Chromium"
	source utils/mktemp.sh

	PROFILE_DIRECTORY="$(mktemp -d)"
	trap 'rm -r "$PROFILE_DIRECTORY"' EXIT
	chromium-browser \
		--user-data-dir="$PROFILE_DIRECTORY" \
		--load-extension=pkg/crx/
else
	source makecrx.sh
	echo "running tests"
	CRX_NAME="`ls -tr pkg/*.crx | tail -1`"
	python2.7 test/chrome/script.py $CRX_NAME
fi
