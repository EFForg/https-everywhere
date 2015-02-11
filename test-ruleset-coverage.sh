#!/bin/sh
#
# Test that all rulesets modified after a certain date have sufficient test
# coverage, according to the ruleset checker.
#
cd $(dirname $0)
TMP=`mktemp`
trap 'rm "$TMP"' EXIT
# Git log gives us all changed files. Pipe that through ls to eliminate files
# that have been deleted.
if ! git log --name-only --date=local --since=2015-02-05 --pretty=format: \
      src/chrome/content/rules/ | sort -u | \
      xargs ls 2>/dev/null | xargs python2.7 https-everywhere-checker/src/https_everywhere_checker/check_rules.py \
      https-everywhere-checker/checker.config.sample ; then
  echo "Ruleset test coverage was insufficient. Please add <test url=...> tags " \
       "to ruleset with additional HTTP URLs to test rewriting and fetching."
  exit 1
else
  exit 0
fi
