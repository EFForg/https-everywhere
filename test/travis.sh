#!/bin/bash
# Wrapper for travis tests

function docker_build {
  docker build -t httpse .
}

# Folder paths, relative to parent
RULESETFOLDER="src/chrome/content/rules"

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

# Fetch the current GitHub version of HTTPS-E to compare to its master
git remote add upstream-for-travis https://github.com/EFForg/https-everywhere.git
trap 'git remote remove upstream-for-travis' EXIT

# Only do a shallow fetch if we're in Travis.  No need otherwise.
if [ $TRAVIS ]; then
  git fetch --depth=50 upstream-for-travis master
else
  git fetch upstream-for-travis master
fi

COMMON_BASE_COMMIT=$(git merge-base upstream-for-travis/master HEAD)
RULESETS_CHANGED=$(git diff --name-only $COMMON_BASE_COMMIT | grep $RULESETFOLDER | grep '.xml')
if [ "$(git diff --name-only $COMMON_BASE_COMMIT)" != "$RULESETS_CHANGED" ]; then
  ONLY_RULESETS_CHANGED=false
fi

# At this point, if anything fails, the test should fail
set -e

if ! $ONLY_RULESETS_CHANGED; then
  echo >&2 "Core code changes have been made."

  if [ "$TEST" == "eslint" ]; then
    echo >&2 "Running ESLint."
    docker run --rm -ti -v $(pwd):/opt node bash -c "cd /opt/utils/eslint && npm install && ./node_modules/.bin/eslint ../../chromium"
  fi

  if [ "$TEST" == "firefox" ]; then
    echo >&2 "Running firefox test suite."
    docker_build
    docker run --rm -ti -v $(pwd):/opt -e FIREFOX=/$FIREFOX/firefox/firefox httpse bash -c "test/firefox.sh"
  fi

  if [ "$TEST" == "chromium" ]; then
    echo >&2 "Running chromium test suite."
    docker_build
    # --privileged is required here because chromium requires kernel lxc access
    docker run --rm -ti -v $(pwd):/opt --privileged httpse bash -c "test/chromium.sh"
  fi
fi
# Only run test if something has changed.
if [ "$RULESETS_CHANGED" ]; then
  echo >&2 "Ruleset database has changed."

  if [ "$TEST" == "rules" ]; then
    echo >&2 "Performing comprehensive coverage test."
    docker_build
    docker run --rm -ti -v $(pwd):/opt httpse python utils/ruleset_filenames_validate.py
    docker run --rm -ti -v $(pwd):/opt httpse bash -c "utils/validate.sh"
    docker run --rm -ti -v $(pwd):/opt httpse bash -c "test/rules.sh"
  fi

  if [ "$TEST" == "fetch" ]; then
    echo >&2 "Testing test URLs in all changed rulesets."
    docker_build
    # --privileged is required here for miredo to create a network tunnel
    docker run --rm -ti -v $(pwd):/opt -e RULESETS_CHANGED="$RULESETS_CHANGED" --privileged httpse bash -c "service miredo start && test/fetch.sh"
  fi

  if [ "$TEST" == "preloaded" ]; then
    echo >&2 "Ensuring rulesets do not introduce targets which are already HSTS preloaded."
    docker run --rm -ti -v $(pwd):/opt -e RULESETS_CHANGED="$RULESETS_CHANGED" node bash -c "cd /opt/utils/hsts-prune && npm install && node index.js"
    [ `git diff --name-only | wc -l` -eq 0 ]
  fi
fi

exit 0
