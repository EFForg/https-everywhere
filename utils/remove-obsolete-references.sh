#!/bin/bash
# Remove obsolete references to child rulesets which
# has been renamed/ deleted


# Change directory to git root; taken from ../test/test.sh
if [ -n "$GIT_DIR" ]
then
    # $GIT_DIR is set, so we're running as a hook.
    cd $GIT_DIR
else
    # Git command exists? Cool, let's CD to the right place.
    git rev-parse && cd "$(git rev-parse --show-toplevel)"
fi

# Run from ruleset folder to simplify the output
cd src/chrome/content/rules

# Default exit status
EXIT_CODE=0

# List of file(s) which contain at least one reference
FILES=`egrep -l '^\s*[-|+]\s*([^ ]*\.xml)\s*$' *.xml`

while read FILE; do
    # List of referenced rulesets
    REFS=`sed -n 's/^\s*[-|+]\s*\([^ ]*\.xml\)\s*$/\1/gp' "$FILE"`

    while read REF; do
        if [ ! -f "$REF" ]; then
            echo >&2 "ERROR src/chrome/content/rules/$FILE: Dangling reference to $REF"
            sed -i "/^\s*[-|+]\s*$REF$/d" "$FILE"
            EXIT_CODE=1
        fi
    done <<< "$REFS"
done <<< "$FILES"

# Exit with errors, if any
exit "$EXIT_CODE"
