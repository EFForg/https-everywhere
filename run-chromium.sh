#!/bin/bash -ex
#
# Build the extension and run a chromium extension with it installed.
#
cd $(dirname $0)
source makecrx.sh
PROFILE_DIRECTORY="$(mktemp -d)"
trap 'rm -r "$PROFILE_DIRECTORY"' EXIT
chromium-browser \
  --user-data-dir="$PROFILE_DIRECTORY" \
  --load-extension=pkg/crx/ "$@"
