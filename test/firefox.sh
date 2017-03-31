#!/bin/bash -ex
# Run Firefox tests for HTTPS Everywhere

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

# dummy Jetpack addon that contains tests
TEST_ADDON_PATH=./test/firefox/

# We'll create a Firefox profile here and install HTTPS Everywhere into it.
PROFILE_DIRECTORY="$(mktemp -d)"
trap 'rm -r "$PROFILE_DIRECTORY"' EXIT
HTTPSE_INSTALL_DIRECTORY=$PROFILE_DIRECTORY/extensions/https-everywhere-eff@eff.org

# Build the XPI to run all the validations in make.sh, and to ensure that
# we test what is actually getting built.
./make.sh
XPI_NAME="`ls -tr pkg/https-everywhere-20*.xpi | tail -1`"

# Set up a skeleton profile and then install into it.
# The skeleton contains a few files required to trick Firefox into thinking
# that the extension was fully installed rather than just unpacked.
rsync -a test/firefox/test_profile_skeleton/ $PROFILE_DIRECTORY
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

# Make sure we have xvfb-run and it's not already set.
if [ -z "$XVFB_RUN" -a -n "$(which xvfb-run)" ]; then
  XVFB_RUN=xvfb-run
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
  if [ $(uname) == Darwin ]; then
    open /Applications/Firefox.app --wait-apps --new --args -no-remote -profile "$PROFILE_DIRECTORY" "$@"
  else
    ${FIREFOX:-firefox} -no-remote -profile "$PROFILE_DIRECTORY" "$@"
  fi
else
  echo "running tests"
  if [ -n "$FIREFOX" ]; then
    $XVFB_RUN cfx test -b $FIREFOX --profiledir="$PROFILE_DIRECTORY" --verbose
  else
    $XVFB_RUN cfx test --profiledir="$PROFILE_DIRECTORY" --verbose
  fi
fi

popd

shasum=$(openssl sha -sha256 "$XPI_NAME")
echo -e "Git commit `git rev-parse HEAD`\n$shasum"
