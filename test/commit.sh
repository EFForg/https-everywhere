#!/bin/bash
# Run https-everywhere-checker for each changed ruleset

# Folder paths, relative to parent
RULESETFOLDER="src/chrome/content/rules"
RULETESTFOLDER="test/rules"

# Go to git repo root; taken from ../test.sh. Note that
# $GIT_DIR is .git in this case.
if [ -n "$GIT_DIR" ]
then
  # $GIT_DIR is set, so we're running as a hook.
  cd $GIT_DIR
  cd ..
else
  # Git command exists? Cool, let's CD to the right place.
  git rev-parse && cd "$(git rev-parse --show-toplevel)"
fi

RULESETS_CHANGED=$(git diff --name-only HEAD | grep $RULESETFOLDER | grep '.xml')

# Only run test if something has changed.
if [ "$RULESETS_CHANGED" ]; then
  echo >&2 "Ruleset database has changed. Testing test URLs in all changed rulesets."

  # Make a list of all changed rulesets, but exclude those
  # that do not exist.
  for RULESET in $RULESETS_CHANGED; do
    # First check if the given ruleset actually exists
    if [ ! -f $RULESET ]; then
      echo >&2 "Skipped $RULESET; file not found."
      continue
    fi
    TO_BE_TESTED="$TO_BE_TESTED $RULESET"
  done

  if [ "$TO_BE_TESTED" ]; then
    # Do the actual test, using https-everywhere-checker.
    TESTOUTPUT=$(python $RULETESTFOLDER/src/https_everywhere_checker/check_rules.py $RULETESTFOLDER/http.checker.config $TO_BE_TESTED 2>&1)
    echo >&2 "$TESTOUTPUT"
    # Unfortunately, no specific exit codes are available for connection
    # failures, so we catch those with grep.
    if [[ "$TESTOUTPUT" =~ "ERROR" ]]; then
      echo >&2 "Test URL test failed."
      exit 1
    fi
  fi
  echo >&2 "Test URL test succeeded."
fi

exit 0
