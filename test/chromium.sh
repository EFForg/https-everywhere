#!/bin/bash -ex
# Run Chromium tests for HTTPS Everywhere

# Get to the repo root directory, even when we're symlinked as a hook.
if [ -n "$GIT_DIR" ]
then
    # $GIT_DIR is set, so we're running as a hook.
    cd $GIT_DIR
else
    # Git command exists? Cool, let's CD to the right place.
    git rev-parse && cd "$(git rev-parse --show-toplevel)"
fi


# If you just want to run Chromium with the latest code:
if [ "$1" == "--justrun" ]; then
	shift
	./makecrx.sh
	echo "running Chromium"
	source utils/mktemp.sh

	PROFILE_DIRECTORY="$(mktemp -d)"
	trap 'rm -r "$PROFILE_DIRECTORY"' EXIT
	chromium-browser \
		--user-data-dir="$PROFILE_DIRECTORY" \
		--load-extension=pkg/crx/
else
	./makecrx.sh
	echo "running tests"
	CRX_NAME="`ls -tr pkg/*.crx | tail -1`"
	python2.7 test/chromium/script.py $CRX_NAME
fi
