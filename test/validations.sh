#!/bin/bash -ex
# Perform validations on rulesets.

utils/remove-obsolete-references.sh
test/validations/path/run.sh
test/validations/test-coverage/run.sh
python3.6 test/validations/securecookie/run.py
python3.6 test/validations/filename/run.py
python3.6 test/validations/relaxng/run.py
python3.6 test/validations/special/run.py --quiet
