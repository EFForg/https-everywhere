#!/bin/bash -e
#
# Test that all rulesets modified after a certain date have sufficient test
# coverage, according to the ruleset checker.
#

# Get to the repo root directory, even when we're symlinked as a hook.
if [ -n "$GIT_DIR" ]
then
    # $GIT_DIR is set, so we're running as a hook.
    cd $GIT_DIR
else
    # Git command exists? Cool, let's CD to the right place.
    git rev-parse && cd "$(git rev-parse --show-toplevel)"
fi

source utils/mktemp.sh

TMP="$(mktemp)"
trap 'rm "$TMP"' EXIT
if ! [ -d test/rules ] ; then
  echo "Submodule https-everywhere-checker is missing. Run"
  echo "./install-dev-dependencies.sh"
  exit 1
fi
if [ $# -gt 0 ] ; then
  exec python3.6 test/rules/src/https_everywhere_checker/check_rules.py \
    test/rules/coverage.checker.config "$@"
fi
if ! python3.6 test/rules/src/https_everywhere_checker/check_rules.py \
      test/rules/coverage.checker.config; then
  echo '
Ruleset test coverage was insufficient.

Under the new ruleset testing rules (February 2015), any modified ruleset
must have sufficient test coverage. You can often improve test coverage by
adding <test url="..." /> tags, or by restructuring the rule to avoid
wildcard <target> tags. See these documents:
https://github.com/EFForg/https-everywhere/blob/master/ruleset-testing.md
https://github.com/EFForg/https-everywhere/blob/master/CONTRIBUTING.md#ruleset-style-guide
'
  exit 1
else
  exit 0
fi
