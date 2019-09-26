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

# Make sure we have xvfb-run and it's not already set.
if [ -z "$XVFB_RUN" -a -n "$(which xvfb-run)" ]; then
  XVFB_RUN=xvfb-run
fi

# If you just want to run Chromium with the latest code:
if [ "$1" == "--justrun" ]; then
	shift
	./make.sh
	echo "running Chromium"
	source utils/mktemp.sh

	PROFILE_DIRECTORY="$(mktemp -d)"
	trap 'rm -r "$PROFILE_DIRECTORY"' EXIT

	# Chromium package name is 'chromium' in Debian 7 (wheezy) and other distros like Arch
	BROWSER="chromium-browser"
	which $BROWSER || BROWSER="chromium"
	$BROWSER \
		--user-data-dir="$PROFILE_DIRECTORY" \
		--load-extension=pkg/crx-cws/ \
		"$@"
else
	./make.sh
	echo "running tests"
	CRX_NAME="`ls -tr pkg/*.crx | tail -1`"
	$XVFB_RUN python3.6 test/script.py Chrome $CRX_NAME
fi
