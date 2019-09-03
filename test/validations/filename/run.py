#!/usr/bin/env python3.6
#
# Validates and provides a generator for ruleset filenames
#

import glob
import os
import re
import sys

import collections

def validate_filenames():
    # Sort filenames so output is deterministic.
    filenames = sorted(glob.glob('src/chrome/content/rules/*'))

    counted_lowercase_names = collections.Counter([name.lower() for name in filenames])
    most_common_entry = counted_lowercase_names.most_common(1)[0]
    if most_common_entry[1] > 1:
        dupe_filename = re.compile(re.escape(most_common_entry[0]), re.IGNORECASE)
        print("{} failed case-insensitivity testing.".format(list(filter(dupe_filename.match, filenames))))
        print("Rules exist with identical case-insensitive names, which breaks some filesystems.")
        sys.exit(1)

    for fi in filenames:
        basename = fi.split(os.path.sep)[-1]
        if basename == '00README' or basename == 'make-trivial-rule' or basename == 'default.rulesets':
            continue

        if " " in fi:
            print("{} failed validity: Rule filenames cannot contain spaces".format(fi))
            sys.exit(1)
        if not fi.endswith('.xml'):
            print("{} failed validity: Rule filenames must end in .xml".format(fi))
            sys.exit(1)

        yield fi

if __name__ == "__main__":
    [ fi for fi in validate_filenames() ]
