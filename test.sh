#!/bin/bash -ex
# Run tests for HTTPS Everywhere

# Get into the project-root. This script may be executed as `test.sh`
# or as .git/hooks/pre-push, so we need to find the directory containing
# test.sh before we can proceed. If $0 is not a symlink, `readlink` will
# print nothing; if it is a symlink it will print the link target.

cd $(dirname $0)/$(dirname $(readlink $0))

./test/rules.sh
./test/firefox.sh $@
./test/chromium.sh $@
