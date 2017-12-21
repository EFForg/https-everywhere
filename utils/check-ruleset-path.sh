#!/bin/bash

if [ -z "$RULESET_FOLDER" ]; then
  RULESET_FOLDER="src/chrome/content/rules"
fi

# Go to git repo root; note that $GIT_DIR is .git in this case.
if [ -n "$GIT_DIR" ]; then
  # GIT_DIR is set, so we're running as a hook.
  cd "$GIT_DIR" && cd ..
elif [ ! `which git > /dev/null` ]; then
  # Git command exists? Cool, let's CD to the right place.
  git rev-parse && cd `git rev-parse --show-toplevel`
else
  # Git is required.
  echo >&2 "ERROR: Failed to change directory. Aborted."
fi 

# Fetch the current GitHub version of HTTPS-E to compare to its master
if [ git ls-remote upstream-for-travis ]; then
  git remote add upstream-for-travis https://github.com/EFForg/https-everywhere.git
  trap 'git remote remove upstream-for-travis' EXIT
fi

if [ "$TRAVIS" ]; then
  git fetch --depth=50 upstream-for-travis master
else
  git fetch upstream-for-travis master
fi

COMMON_BASE_COMMIT=`git merge-base upstream-for-travis/master HEAD`
CHANGED_FILES=`git diff --name-only $COMMON_BASE_COMMIT | grep -v $RULESET_FOLDER`

EXIT_CODE=0

if [ "$CHANGED_FILES" != "" ]; then
  while read FILE; do
    # check if changed file is actually a ruleset
    egrep -q "^<ruleset[^>]+>" "$FILE"

    # if file matched the RegExp
    if [ $? -eq 0 ]; then
      echo >&2 "ERROR: $FILE Inclusion of ruleset outside of $RULESET_FOLDER"
      EXIT_CODE=1
    fi
  done <<< "$CHANGED_FILES"
fi

exit $EXIT_CODE
