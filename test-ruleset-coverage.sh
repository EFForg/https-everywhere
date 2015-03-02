#!/bin/sh
#
# Test that all rulesets modified after a certain date have sufficient test
# coverage, according to the ruleset checker.
#
cd $(dirname $0)
TMP=`mktemp`
trap 'rm "$TMP"' EXIT
if ! [ -d https-everywhere-checker ] ; then
  echo "Submodule https-everywhere-checker is missing. Run"
  echo "./install-dev-dependencies.sh"
  exit 1
fi
# Git log gives us all changed files. Pipe that through ls to eliminate files
# that have been deleted.
if ! python2.7 https-everywhere-checker/src/https_everywhere_checker/check_rules.py \
      https-everywhere-checker/coverage.checker.config; then
  echo "Ruleset test coverage was insufficient."
  echo ""
  echo "Under the new ruleset testing rules (February 2015), any modified ruleset"
  echo "must have sufficient test coverage. You can often improve test coverage by"
  echo "adding <test url='...' /> tags, or by restructuring the rule to avoid"
  echo "wildcard <target> tags. See these documents:"
  echo "https://github.com/EFForg/https-everywhere/blob/master/ruleset-testing.md"
  echo "https://github.com/EFForg/https-everywhere/blob/master/ruleset-style.md"
  exit 1
else
  exit 0
fi
