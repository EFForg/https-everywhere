#!/bin/bash -ex
# Run tests for HTTPS Everywhere

# Get into the project-root. This script may be executed as `test.sh`
# or as .git/hooks/pre-push, so we need to find the directory containing
# test.sh before we can proceed.

if [ -n "$GIT_DIR" ]
then
    # $GIT_DIR is set, so we're running as a hook.
    cd $GIT_DIR
else
    # Git command exists? Cool, let's CD to the right place.
    git rev-parse && cd "$(git rev-parse --show-toplevel)"
fi

./test/validations.sh
./test/firefox.sh $@
./test/chromium.sh $@
