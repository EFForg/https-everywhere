#!/usr/bin/env python3.6

# Merge all the .xml rulesets into a single "default.rulesets" file -- this
# prevents inodes from wasting disk space, but more importantly, this works
# around the fact that zip does not perform well on a pile of small files.

# Currently, it merges rulesets into a JSON Object for minimal overhead,
# in both storage and parsing speed.

import argparse
import glob
import json
import os
import unicodedata
import xml.etree.ElementTree

def normalize(f):
    """
    OSX and Linux filesystems encode composite characters differently in
    filenames. We should normalize to NFC: http://unicode.org/reports/tr15/
    """
    f = unicodedata.normalize("NFC", f)
    return f

# commandline arguments parsing (nobody use it, though)
parser = argparse.ArgumentParser(description="Merge rulesets")
parser.add_argument("--source_dir", default="src/chrome/content/rules")

args = parser.parse_args()

# output filename, pointed to the merged ruleset
ofn = os.path.join(args.source_dir, "default.rulesets")

# XML Ruleset Files
files = map(normalize, glob.glob(os.path.join(args.source_dir, "*.xml")))

# Under git bash, sed -i issues errors and sets the file "read-only".
if os.path.isfile(ofn):
    os.system("chmod u+w " + ofn)

# Library (JSON Object)
library = []

# Parse XML ruleset and construct JSON library
print(" * Parsing XML ruleset and constructing JSON library...")
for filename in sorted(files):
    tree = xml.etree.ElementTree.parse(filename)
    root = tree.getroot()

    ruleset = {}

    for attr in root.attrib:
        ruleset[attr] = root.attrib[attr]

    for child in root:
        if child.tag in ["target", "rule", "securecookie", "exclusion"]:
            if child.tag not in ruleset:
                ruleset[child.tag] = []
        else:
            continue

        if child.tag == "target":
            ruleset["target"].append(child.attrib["host"])

        elif child.tag == "rule":
            ru = {}
            ru["from"] = child.attrib["from"]
            ru["to"] = child.attrib["to"]

            ruleset["rule"].append(ru)

        elif child.tag == "securecookie":
            sc = {}
            sc["host"] = child.attrib["host"]
            sc["name"] = child.attrib["name"]

            ruleset["securecookie"].append(sc)

        elif child.tag == "exclusion":
            ruleset["exclusion"].append(child.attrib["pattern"])

    library.append(ruleset);

# Write to default.rulesets
print(" * Writing JSON library to %s" % ofn)
outfile = open(ofn, "w")
outfile.write(json.dumps(library))
outfile.close()

# Everything is okay.
print(" * Everything is okay.")
