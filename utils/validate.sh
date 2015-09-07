#!/bin/bash
# Validates rulesets, using both trivial-validate.py (slower, can make more
# complicated assertions) and xmllint with our custom RELAX NG grammar that
# specifies the format of ruleset XML (faster, more limited).
#
# The rulesets sqlite must already have been generated at
# https-everywhere/pkg/rulesets.unvalidated.sqlite.
#
# If validation is successful, that file will be copied to
# https-everywhere/src/defaults/rulesets.sqlite for inclusion in the XPI.
set -o errexit -o pipefail
cd $(dirname $0)

# =============== BEGIN VALIDATION ================
# Unless we're in a hurry, validate the ruleset library & locales

die() {
  echo >&2 "ERROR:" "$@"
  exit 1
}

INPUT="../pkg/rulesets.unvalidated.sqlite"

if python2.7 trivial-validate.py --quiet --db "$INPUT" >&2
then
  echo Validation of included rulesets completed. >&2
  echo >&2
else
  die "Validation of rulesets failed."
fi

# Check for xmllint.
type xmllint >/dev/null || die "xmllint not available"

GRAMMAR="relaxng.xml"
# xmllint spams stderr with "<FILENAME> validates, even with the --noout
# flag. We can't grep -v for that line, because the pipeline will mask error
# status from xmllint. Instead we run it once going to /dev/null, and if
# there's an error run it again, showing only error output.
validate_grammar() {
  find ../src/chrome/content/rules -name "*.xml" | \
   xargs xmllint --noout --relaxng $GRAMMAR
}
if validate_grammar 2>/dev/null
then
  echo Validation of rulesets against $GRAMMAR succeeded. >&2
else
  validate_grammar 2>&1 | grep -v validates
  die "Validation of rulesets against $GRAMMAR failed."
fi

cp "$INPUT" ../src/defaults/rulesets.sqlite
