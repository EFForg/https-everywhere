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

if [ ! -d "$HTTPSE_INSTALL_DIRECTORY" ]; then
  die "Firefox profile does not have HTTPS Everywhere installed"
fi

# Make sure we have xvfb-run and it's not already set.
if [ -z "$XVFB_RUN" -a -n "$(which xvfb-run)" ]; then
  XVFB_RUN=xvfb-run
fi

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

  PATH=/home/user/geckodriver:$PATH
  if [ -n "$FIREFOX" ]; then
    $XVFB_RUN python2.7 test/script.py Firefox "$PROFILE_DIRECTORY" $FIREFOX
  else
    $XVFB_RUN python2.7 test/script.py Firefox "$PROFILE_DIRECTORY"
  fi
fi
