#!/bin/bash

python2.7 utils/ruleset_filenames_validate.py
utils/check-ruleset-path.sh
utils/remove-obsolete-references.sh
python2.7 utils/validate.py
python2.7 utils/trivial-validate.py --quiet
test/test-coverage.sh
python2.7 utils/normalize-securecookie.py
