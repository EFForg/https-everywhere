#!/bin/bash
# Run Chromium tests for HTTPS Everywhere
#
# Get into the project-root. This script may be executed as `chromium.sh`
# or as ./test/chromium.sh, so we need to find the directory
# containing firefox.sh before we can proceed. If $0 is not a symlink,
# `readlink` will print nothing; if it is a symlink it will print the
# link target.

set -o errexit -o xtrace

cd $(dirname $0)/$(dirname $(readlink $0))../

# If you just want to run Chromium with the latest code:
if [ "$1" == "--justrun" ]; then
	shift
	./makecrx.sh
	echo "running Chromium"
	./utils/mktemp.sh

	PROFILE_DIRECTORY="$(mktemp -d)"
	trap 'rm -r "$PROFILE_DIRECTORY"' EXIT
	chromium-browser \
		--user-data-dir="$PROFILE_DIRECTORY" \
		--load-extension=pkg/crx/
else
	source makecrx.sh
	echo "running tests"
	CRX_NAME="`ls -tr pkg/*.crx | tail -1`"
	python2.7 test/chromium/script.py $CRX_NAME
fi
