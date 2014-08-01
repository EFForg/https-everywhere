#!/bin/bash

set -e
cd "`dirname $0`"

# dummy Jetpack addon that contains tests
TEST_ADDON_PATH=./https-everywhere-tests/
LATEST_SDK_VERSION=1.16

# firefox profile that has HTTPS Everywhere installed
PROFILE_DIRECTORY=./test_profile
HTTPSE_INSTALL_DIRECTORY=./test_profile/extensions/https-everywhere@eff.org

if [ ! -d "$TEST_ADDON_PATH" ]; then
  echo "Test addon path does not exist"
  exit 1
fi

if [ ! -d "$PROFILE_DIRECTORY" ]; then
  echo "Firefox profile directory does not exist"
  exit 1
fi

if [ ! -d "$HTTPSE_INSTALL_DIRECTORY" ]; then
  echo "Firefox profile does not have HTTPS Everywhere installed"
  exit 1
fi

if ! type cfx > /dev/null; then
  echo "Please activate the Firefox Addon SDK before running this script."
  exit 1
fi

if ! cfx --version | grep -q "$LATEST_SDK_VERSION"; then
    echo "Please use the latest stable SDK version or edit this script to the current version."
    exit 1
fi

cd src/
rsync -av --exclude-from="../.build_exclusions" . ../$HTTPSE_INSTALL_DIRECTORY

cd ../$TEST_ADDON_PATH
echo "running tests"
cfx test --profiledir="../$PROFILE_DIRECTORY" --verbose
