#!/bin/bash -ex
# Run tests for HTTPS Everywhere

# Get into the project-root. This script may be executed as `test.sh`
# or as .git/hooks/pre-push, so we need to find the directory containing
# test.sh before we can proceed. If $0 is not a symlink, `readlink` will
# print nothing; if it is a symlink it will print the link target.
cd $(dirname $0)/$(dirname $(readlink $0))

source utils/mktemp.sh

# dummy Jetpack addon that contains tests
TEST_ADDON_PATH=./https-everywhere-tests/

# We'll create a Firefox profile here and install HTTPS Everywhere into it.
PROFILE_DIRECTORY="$(mktemp -d)"
trap 'rm -r "$PROFILE_DIRECTORY"' EXIT
HTTPSE_INSTALL_DIRECTORY=$PROFILE_DIRECTORY/extensions/https-everywhere-eff@eff.org

# Build the XPI to run all the validations in makexpi.sh, and to ensure that
# we test what is actually getting built.
./makexpi.sh
XPI_NAME="`ls -tr pkg/*-eff.xpi | tail -1`"

# Set up a skeleton profile and then install into it.
# The skeleton contains a few files required to trick Firefox into thinking
# that the extension was fully installed rather than just unpacked.
rsync -a https-everywhere-tests/test_profile_skeleton/ $PROFILE_DIRECTORY
unzip -qd $HTTPSE_INSTALL_DIRECTORY $XPI_NAME

die() {
  echo "$@"
  exit 1
}

if [ ! -f "addon-sdk/bin/activate" ]; then
  die "Addon SDK not available. Run git submodule update."
fi

if [ ! -d "$HTTPSE_INSTALL_DIRECTORY" ]; then
  die "Firefox profile does not have HTTPS Everywhere installed"
fi

# Activate the Firefox Addon SDK.
pushd addon-sdk
source bin/activate
popd

if ! type cfx > /dev/null; then
  die "Addon SDK failed to activiate."
fi

pushd $TEST_ADDON_PATH

# If you just want to run Firefox with the latest code:
if [ "$1" == "--justrun" ]; then
  echo "running firefox"
  shift
  firefox -no-remote -profile "$PROFILE_DIRECTORY" "$@"
else
  echo "running tests"
  cfx test --profiledir="$PROFILE_DIRECTORY" --verbose
fi

popd

bash test-ruleset-coverage.sh
# Echo the version of sqlite3, since the determinism of the build depends on
# having the same version.
echo "To reproduce this build (https://wiki.debian.org/ReproducibleBuilds)," \
     "please use this version of sqlite3:"
sqlite3 -version
shasum=$(openssl sha -sha256 "$XPI_NAME")
echo -e "Git commit `git rev-parse HEAD`\n$shasum"
