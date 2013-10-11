#!/bin/sh
#
#   utils/precommit.sh hook script of https-everywhere.
#
#   Author: Jonathan Davies <jpdavs@gmail.com>
#

echo "$(date -R): Stashing unrelated changes in Git..."
git stash -q --keep-index

echo "$(date -R): Running tests:"
./utils/trivial-validate.py src/chrome/content/rules > /dev/null
RESULT=$?

if [ $RESULT -eq 1 ]; then
    echo "$(date -R): Failure encountered during ruleset validation."
fi

echo "$(date -R): Reverting Git stash..."
git stash pop -q

exit $RESULT
