#!/usr/bin/env python2.7
#
# Builds a JSON DB containing all the rulesets, indexed by target.
# The JSON DB is used by the Chrome extension & Firefox (WebExtensions) addon.
#

import locale
import json
import os
import sys

import collections
from lxml import etree

from ruleset_filenames_validate import validate_filenames

# Explicitly set locale so sorting order for filenames is consistent.
# This is important for deterministic builds.
# https://trac.torproject.org/projects/tor/ticket/11630#comment:20
# It's also helpful to ensure consistency for the lowercase check below.
locale.setlocale(locale.LC_ALL, 'C')

json_path = os.path.join(os.path.dirname(__file__), '../pkg/rulesets.json')

json_output = {
    "rulesetStrings": [],
    "targets": collections.defaultdict(list)
}

parser = etree.XMLParser(remove_blank_text=True)

# Precompile xpath expressions that get run repeatedly.
xpath_host = etree.XPath("/ruleset/target/@host")
xpath_ruleset = etree.XPath("/ruleset")

for fi in validate_filenames():

    try:
        tree = etree.parse(fi, parser)
    except Exception as oops:
        print("%s failed XML validity: %s\n" % (fi, oops))
        sys.exit(1)

    # Remove comments to save space.
    etree.strip_tags(tree, etree.Comment)

    targets = xpath_host(tree)
    if not targets:
        print('File %s has no targets' % fi)
        sys.exit(1)

    # Strip out the target tags. These aren't necessary in the DB because
    # targets are looked up in the target table, which has a foreign key
    # pointing into the ruleset table.
    etree.strip_tags(tree, 'target')
    etree.strip_tags(tree, 'test')

    # Store the filename in the `f' attribute so "view source XML" for rules in
    # FF version can find it.
    xpath_ruleset(tree)[0].attrib["f"] = os.path.basename(fi).decode(encoding="UTF-8")

    for target in targets:
        # id is the current length of the rules list - i.e. the offset at which
        # this rule will be added in the list.
        json_output["targets"][target].append(len(json_output["rulesetStrings"]))
    json_output["rulesetStrings"].append(etree.tostring(tree))

with open(json_path, 'w') as f:
    f.write(json.dumps(json_output))
