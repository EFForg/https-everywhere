#!/bin/bash

CHANGED_FILES=`git diff --name-only $COMMON_BASE_COMMIT | grep -v $RULESETFOLDER | grep '.xml'`

EXIT_CODE=0

if [ "$CHANGED_FILES" != "" ]; then
  while read FILE; do
    # check if changed file is actually a ruleset
    egrep -q "^<ruleset[^>]+>" "$FILE"

    # if file matched the RegExp
    if [ $? -eq 0 ]; then
      echo >&2 "ERROR: $FILE Inclusion of ruleset outside of $RULESETFOLDER"
      EXIT_CODE=1
    fi
  done <<< "$CHANGED_FILES"
fi

exit $EXIT_CODE
