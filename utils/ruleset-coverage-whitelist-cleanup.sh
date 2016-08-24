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
DELIM="  "

while IFS=$DELIM read listed_hash file; do
  display_hash=$(echo $listed_hash | cut -c-7)
  # Remove those that no longer exist
  if [ ! -f $file ]; then
    sed -i "/$listed_hash$DELIM$file/d" $WLIST
    echo >&2 "Removed $file ($display_hash): file no longer exists"
  else
    actual_hash=$(sha256sum $file | cut -c-64)
    # Remove those whose hashes do not match
    if [ "$listed_hash" != "$actual_hash" ]; then
      sed -i "/$listed_hash$DELIM$file/d" $WLIST
      echo >&2 "Removed $file ($display_hash): listed hash does not match actual hash"
    fi
  fi
done < "$WLIST"
