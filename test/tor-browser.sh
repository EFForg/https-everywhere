#!/bin/bash -ex
# Just run the Tor Browser with HTTPS Everywhere

# Get to the repo root directory, even when we're symlinked as a hook.

if [ -n "$GIT_DIR" ]
then
    # $GIT_DIR is set, so we're running as a hook.
    cd $GIT_DIR
else
    # Git command exists? Cool, let's CD to the right place.
    git rev-parse && cd "$(git rev-parse --show-toplevel)"
fi


source utils/mktemp.sh

die() {
  echo "$@"
  exit 1
}

# Unzip the Tor Browser archive to a temporary directory
if [ ! -f "$1" ] && [ "`echo $1 | tail -c 8 | head -c 7`" != ".tar.xz" ]; then
  echo "Usage: $0 [path_to_tor_archive]"
  echo
  die "File provided is not a valid Tor Browser archive."
fi

PROFILE_DIRECTORY="$(mktemp -d)"
trap 'rm -r "$PROFILE_DIRECTORY"' EXIT
tar -Jxvf $1 -C $PROFILE_DIRECTORY > /dev/null
TBB_LOCALIZED_DIRECTORY=`find $PROFILE_DIRECTORY -maxdepth 1 -mindepth 1 -type d`
HTTPSE_INSTALL_XPI=$TBB_LOCALIZED_DIRECTORY/Browser/TorBrowser/Data/Browser/profile.default/extensions/https-everywhere-eff@eff.org.xpi
echo 'pref("extensions.https_everywhere.log_to_stdout", true);' >> $TBB_LOCALIZED_DIRECTORY/Browser/TorBrowser/Data/Browser/profile.default/preferences/extension-overrides.js
echo 'pref("extensions.https_everywhere.LogLevel", 0);' >> $TBB_LOCALIZED_DIRECTORY/Browser/TorBrowser/Data/Browser/profile.default/preferences/extension-overrides.js
# Remove the prebundled HTTPSE
rm -rf $HTTPSE_INSTALL_XPI

# Build the XPI to run all the validations in makexpi.sh, and to ensure that
# we test what is actually getting built.
./make.sh
XPI_NAME="`ls -tr pkg/https-everywhere-20*.xpi | tail -1`"

# Install into our fresh Tor Browser
cp -a $XPI_NAME $HTTPSE_INSTALL_XPI

if [ ! -f "$HTTPSE_INSTALL_XPI" ]; then
  die "Tor Browser does not have HTTPS Everywhere installed"
fi

echo "running tor browser"
$TBB_LOCALIZED_DIRECTORY/Browser/start-tor-browser --verbose ${@:2}

shasum=$(openssl sha -sha256 "$XPI_NAME")
echo -e "Git commit `git rev-parse HEAD`\n$shasum"
