#!/bin/bash
# Validates rulesets, using both trivial-validate.py (slower, can make more
# complicated assertions) and xmllint with our custom RELAX NG grammar that
# specifies the format of ruleset XML (faster, more limited).
set -o errexit -o pipefail
cd $(dirname $0)

# =============== BEGIN VALIDATION ================
# Unless we're in a hurry, validate the ruleset library & locales

die() {
  echo >&2 "ERROR:" "$@"
  exit 1
}

if python2.7 trivial-validate.py --quiet >&2
then
  echo Validation of included rulesets completed. >&2
  echo >&2
else
  die "Validation of rulesets failed."
fi

# Check for xmllint.
type xmllint >/dev/null || die "xmllint not available"

GRAMMAR="relaxng.xml"
# xmllint spams stderr with "<FILENAME> validates, even with the --noout flag,
# so we capture only the results that do not contain 'validates'
validate_grammar() {
  find ../src/chrome/content/rules -name "*.xml" | \
   xargs xmllint --noout --relaxng $GRAMMAR
}
grammar_errors=$(validate_grammar 2>&1 | grep -v "validates" || true)
if [ -z "$grammar_errors" ]
then
  echo Validation of rulesets against $GRAMMAR succeeded. >&2
else
  echo >&2 "$grammar_errors"
  # One very common error is to mess up rule attributes, so we check for
  # this explicitly.
  if [[ $grammar_errors == *"Element rule failed to validate attributes"* ]]
  then
    echo "Two very common reasons for this are the following:"
    echo "- Missing caret (^) in 'from' attribute: it should be \"^http:\" and not \"http:\"."
    echo "- Missing trailing slashes in 'from' or 'to' when specifying full hostnames: it should be \"https://eff.org/\" and not \"https://eff.org\"."
  fi
  die "Validation of rulesets against $GRAMMAR failed."
fi
