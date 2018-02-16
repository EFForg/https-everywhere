#!/usr/bin/env python3.6

# This python utility check for wildcard securecookies which
# can be normalized, warn and exit with non-zero when such
# rulesets exist.

# This is create in attempt to fix the issues on
# https://github.com/EFForg/https-everywhere/pull/13840
# https://github.com/EFForg/https-everywhere/pull/12493

import argparse
import glob
import os
import unicodedata
import xml.etree.ElementTree

def normalize_fn(fn):
    """
    OSX and Linux filesystems encode composite characters differently in
    filenames. We should normalize to NFC: https://unicode.org/reports/tr15/
    """
    fn = unicodedata.normalize("NFC", fn)
    return fn

def should_normalize_securecookie(host, name):
    wildcards = [ ".", ".*" ]
    return True if host in wildcards or name in wildcards else False

# commandline arguments parsing (nobody use it, though)
parser = argparse.ArgumentParser(description="Normalize wildcard securecookies")
parser.add_argument("--source_dir", default="src/chrome/content/rules")

args = parser.parse_args()

# Exit code
exit_with_non_zero = False

# XML ruleset files
filenames = map(normalize_fn, glob.glob(os.path.join(args.source_dir, "*.xml")))

for filename in filenames:
    tree = xml.etree.ElementTree.parse(filename)
    root = tree.getroot()

    for branch in root:
        if branch.tag != "securecookie":
            continue

        host = branch.attrib["host"]
        name = branch.attrib["name"]

        if should_normalize_securecookie(host, name):
            print ("ERROR {}: contains wildcard securecookies "\
                    "which can be normalized.".format(filename))
            exit_with_non_zero = True
            break

exit(0) if not exit_with_non_zero else exit(1)
