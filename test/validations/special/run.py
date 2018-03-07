#!/usr/bin/env python3.6

import glob
import argparse
import os
import re
import sys

from lxml import etree
from collections import Counter

parser = argparse.ArgumentParser(
    formatter_class=argparse.RawDescriptionHelpFormatter,
    description="Ruleset validation script.")
parser.add_argument('--quiet', action="store_true",
    default=False, help="Suppress debug output."
    )

args = parser.parse_args()

quiet = args.quiet

def warn(s):
    if not quiet:
        sys.stdout.write("warning: %s\n" % s)

def fail(s):
    sys.stdout.write("failure: %s\n" % s)

# Precompile xpath expressions that get run repeatedly.
xpath_exclusion_pattern = etree.XPath("/ruleset/exclusion/@pattern")
xpath_cookie_host_pattern = etree.XPath("/ruleset/securecookie/@host")
xpath_cookie_name_pattern = etree.XPath("/ruleset/securecookie/@name")

# Load lists of ruleset names whitelisted for duplicate rules
thispath = os.path.dirname(os.path.realpath(__file__))
with open(thispath + '/duplicate-whitelist.txt') as duplicate_fh:
    duplicate_allowed_list = [x.rstrip('\n') for x in duplicate_fh.readlines()]

filenames = glob.glob(thispath + '/../../../src/chrome/content/rules/*')

def test_bad_regexp(tree, rulename, from_attrib, to):
    # Rules with invalid regular expressions.
    """The rule contains an invalid extended regular expression."""
    patterns = (from_attrib + xpath_exclusion_pattern(tree) +
        xpath_cookie_host_pattern(tree) + xpath_cookie_name_pattern(tree))
    for pat in patterns:
        try:
            re.compile(pat)
        except:
            return False
    return True

def unescaped_dot(s):
    escaped = False
    bracketed = False
    for c in s:
        if c == "\\":
           escaped = not escaped
        elif not escaped and c == "[":
           bracketed = True
        elif not escaped and c == "]":
           bracketed = False
        elif not escaped and not bracketed and c == ".":
           return True
        elif not bracketed and c == "/":
           break
        else:
           escaped = False
    return False

def test_unescaped_dots(tree, rulename, from_attrib, to):
    # Rules containing unescaped dots outside of brackets and before slash.
    # Note: this is meant to require example\.com instead of example.com,
    # but it also forbids things like .* which usually ought to be replaced
    # with something like ([^/:@\.]+)
    """The 'from' rule contains unescaped period in regular expression.  Try escaping it with a backslash."""
    for f in from_attrib:
        s = re.sub("^\^https?://", "", f)
        if unescaped_dot(s):
            return False
    return True

def test_unescaped_dots_in_exclusion(tree, rulename, from_attrib, to):
    """The 'exclusion' tag contains unescaped period in regular expression. Try escaping it with a backslash."""
    pattern_attrib = etree.XPath("/ruleset/exclusion/@pattern")(tree)
    for f in pattern_attrib:
        if unescaped_dot(f):
            return False
    return True

xpath_rule = etree.XPath("/ruleset/rule")
def test_unencrypted_to(tree, rulename, from_attrib, to):
    # Rules that redirect to something other than https or http.
    # This used to test for http: but testing for lack of https: will
    # catch more kinds of mistakes.
    """Rule redirects to something other than https."""
    for rule in xpath_rule(tree):
        to = rule.get("to")
        if to[:6] != "https:":
            return False
    return True

printable_characters = set(map(chr, list(range(32, 127))))

def test_non_ascii(tree, rulename, from_attrib, to):
    # Rules containing non-printable characters.
    """Rule contains non-printable character in 'to' pattern."""
    for t in to:
        for c in t:
            if c not in printable_characters:
                return False
    return True

def is_valid_target_host(host):
    # Rules where a target host contains multiple wildcards or a slash.
    """The target host must be a hostname, not URL, and must use at most one wildcard."""
    if "/" in host:
        return False
    if host.count("*") > 1:
        return False
    return True

def nomes_all(where=sys.argv[1:]):
    """Returns generator to extract all files from a list of files/dirs"""
    if not where: where=['.']
    for i in where:
        if os.path.isfile(i):
            yield i
        elif os.path.isdir(i):
            for r, d, f in os.walk(i):
                for filename in f:
                    yield os.path.join(r, filename)

tests = [
  test_bad_regexp,
  test_unescaped_dots,
  test_unescaped_dots_in_exclusion,
  test_unencrypted_to,
  test_non_ascii
]

failure = 0
seen_file = False

xpath_ruleset = etree.XPath("/ruleset")
xpath_ruleset_name = etree.XPath("/ruleset/@name")
xpath_ruleset_platform = etree.XPath("/ruleset/@platform")
xpath_host = etree.XPath("/ruleset/target/@host")
xpath_from = etree.XPath("/ruleset/rule/@from")
xpath_to = etree.XPath("/ruleset/rule/@to")

print("Complex validations & assertions of rulesets using test/validations/special/run.py begins...")

host_counter = Counter()
for filename in filenames:
    xml_parser = etree.XMLParser(remove_blank_text=True)

    basename = filename.split(os.path.sep)[-1]
    if basename == '00README' or basename == 'make-trivial-rule' or basename == 'default.rulesets':
        continue

    try:
        tree = etree.parse(filename, xml_parser)
    except Exception as oops:
        print("{} failed XML validity: {}\n".format(filename, oops))
        sys.exit(1)

    if not xpath_ruleset(tree):
        continue
    rn = xpath_ruleset_name(tree)[0]
    if not rn:
        failure = 1
        fail("unnamed ruleset")
        continue
    from_attrib = xpath_from(tree)
    to = xpath_to(tree)
    for test in tests:
        if not test(tree, rn, from_attrib=from_attrib, to=to):
            failure = 1
            fail("%s failed test: %s" % (filename, test.__doc__))

    targets = xpath_host(tree)
    for target in targets:
        host_counter.update([target])


for host, count in host_counter.most_common():
    if count > 1:
        if host in duplicate_allowed_list:
            warn("Whitelisted hostname %s shows up in %d different rulesets." % (host, count))
        else:
            failure = 1
            fail("Hostname %s shows up in %d different rulesets." % (host, count))
    if not is_valid_target_host(host):
        failure = 1
        fail("%s failed: %s" % (host, is_valid_target_host.__doc__))

if failure > 0:
    print("Complex validations & assertions of rulesets using test/validations/special/run.py failed.")
else:
    print("Complex validations & assertions of rulesets using test/validations/special/run.py succeeded.")


sys.exit(failure)
