#!/bin/bash
# Remove from ruleset whitelist the filenames of files that
# no longer exist or have no matching hash sums.

# Change directory to git root; taken from ../test/test.sh
if [ -n "$GIT_DIR" ]
then
    # $GIT_DIR is set, so we're running as a hook.
    cd $GIT_DIR
else
    # Git command exists? Cool, let's CD to the right place.
    git rev-parse && cd "$(git rev-parse --show-toplevel)"
fi

# Run from ruleset folder to simplify sha256sum output
cd src/chrome/content/rules
WLIST=../../../../utils/ruleset-coverage-whitelist.txt
WLISTFILES=$(cut -f3 -d " " $WLIST)

for file in $WLISTFILES; do
  # Remove those that no longer exist
  if [ ! -f $file ]; then
    sed -i "/ $file/d" $WLIST
    echo >&2 "Removed $file: file no longer exists"
  # Remove those whose hashes no longer match
  elif ! grep -q $(sha256sum $file) $WLIST; then
    sed -i "/ $file/d" $WLIST
    echo >&2 "Removed $file: file no longer matches the whitelist hash"
  fi
done
