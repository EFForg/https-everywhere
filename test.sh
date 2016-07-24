#!/bin/bash -ex
# Run tests for HTTPS Everywhere

# Get into the project-root. This script may be executed as `test.sh`
# or as .git/hooks/pre-push, so we need to find the directory containing
# test.sh before we can proceed.

RULESETFOLDER="src/chrome/content/rules"

if [ -n "$GIT_DIR" ]
then
    # $GIT_DIR is set, so we're running as a hook.
    cd $GIT_DIR
else
    # Git command exists? Cool, let's CD to the right place.
    git rev-parse && cd "$(git rev-parse --show-toplevel)"
fi

if [ $CI ]; then
# Fetch the current GitHub version of HTTPS-E to compare to its master
git remote add upstream-for-travis https://github.com/EFForg/https-everywhere.git
git fetch upstream-for-travis master 
COMMON_BASE_COMMIT=$(git merge-base upstream-for-travis/master HEAD)
RULESETS_CHANGED=$(git diff --name-only $COMMON_BASE_COMMIT | grep $RULESETFOLDER | grep '.xml')
git remote remove upstream-for-travis
./test/rules.sh $RULESETS_CHANGED
else
./test/rules.sh
fi
./test/firefox.sh $@
./test/chromium.sh $@
