#!/bin/bash -ex

# BSD readlink and mktemp have different APIs from their GNU counterparts. On
# OSX systems we'll have g-prefixed GNU versions installed by Homebrew. Real
# BSD systems are still left in the cold.

READLINK=$(which readlink 2>/dev/null || true)
GREADLINK=$(which greadlink 2>/dev/null || true)
if [ -x "$GREADLINK" ]; then
  READLINK="$GREADLINK"
fi
unset GREADLINK

MKTEMP=$(which mktemp 2>/dev/null || true)
GMKTEMP=$(which gmktemp 2>/dev/null || true)
if [ -x "$GMKTEMP" ]; then
  MKTEMP="$GMKTEMP"
fi
unset GMKTEMP

check_for_gnu_version() {
  gnu_available=$("$1" --version 2>&1 | grep GNU)
  if [ ! "$gnu_available" ]; then
    echo "Could not locate a GNU version of ${2}. This may mean you're using "\
         "a non-OSX BSD system, which these scripts don't know how to handle. "
    echo "If you are indeed using OSX, something may have gone wrong running "\
         "install-dev-dependencies.sh. Look for errors related to coreutils."
    exit 1
  fi
}

check_for_gnu_version "$MKTEMP" "mktemp"
check_for_gnu_version "$READLINK" "readlink"
