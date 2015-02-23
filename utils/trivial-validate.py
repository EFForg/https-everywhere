#!/usr/bin/env python2.7

import argparse
import os
import re
import sqlite3
import sys

from lxml import etree

parser = argparse.ArgumentParser(
    formatter_class=argparse.RawDescriptionHelpFormatter,
    description="Ruleset validation script.")
parser.add_argument('--quiet', action="store_true",
    default=False, help="Suppress debug output."
    )
parser.add_argument('--db',
    default=os.path.join(os.path.dirname(__file__),
                         "../src/defaults/rulesets.sqlite"),
    help='SQLite db with rules')

args = parser.parse_args()

quiet = args.quiet

def warn(s):
    if not quiet:
        sys.stdout.write("warning: %s\n" % s)

def fail(s):
    sys.stdout.write("failure: %s\n" % s)

# Precompile xpath expressions that get run repeatedly.
xpath_exlusion_pattern = etree.XPath("/ruleset/exclusion/@pattern")
xpath_cookie_pattern = etree.XPath("/ruleset/securecookie/@host")

# Load lists of ruleset names whitelisted for downgrade & duplicate rules
thispath = os.path.dirname(os.path.realpath(__file__))
with open(thispath + '/downgrade-whitelist.txt') as downgrade_fh:
    downgrade_allowed_list = [x.rstrip('\n') for x in downgrade_fh.readlines()]
with open(thispath + '/duplicate-whitelist.txt') as duplicate_fh:
    duplicate_allowed_list = [x.rstrip('\n') for x in duplicate_fh.readlines()]


def test_bad_regexp(tree, filename, from_attrib, to):
    # Rules with invalid regular expressions.
    """The 'from' rule contains an invalid extended regular expression."""
    patterns = from_attrib + xpath_exlusion_pattern(tree) + xpath_cookie_pattern(tree)
    for pat in patterns:
        try:
            re.compile(pat)
        except:
            return False
    return True

def test_unescaped_dots(tree, filename, from_attrib, to):
    # Rules containing unescaped dots outside of brackets and before slash.
    # Note: this is meant to require example\.com instead of example.com,
    # but it also forbids things like .* which usually ought to be replaced
    # with something like ([^/:@\.]+)
    """The 'from' rule contains unescaped period in regular expression.  Try escaping it with a backslash."""
    for f in from_attrib:
        escaped = False
        bracketed = False
        s = re.sub("^\^https?://", "", f)
        for c in s:
            if c == "\\":
               escaped = not escaped
            elif not escaped and c == "[":
               bracketed = True
            elif not escaped and c == "]":
               bracketed = False
            elif not escaped and not bracketed and c == ".":
               return False
            elif not bracketed and c == "/":
               break
            else:
               escaped = False
    return True

xpath_rule = etree.XPath("/ruleset/rule")
def test_unencrypted_to(tree, filename, from_attrib, to):
    # Rules that redirect to something other than https or http.
    # This used to test for http: but testing for lack of https: will
    # catch more kinds of mistakes.
    # Now warn if the rule author indicates they intended it, with the
    # downgrade attribute.  Error if this attribute is not present.
    """Rule redirects to something other than https."""
    for rule in xpath_rule(tree):
        to, downgrade = rule.get("to"), rule.get("downgrade")
        if to[:6] != "https:" and to[:5] != "http:":
            return False
        elif to[:5] == "http:" and downgrade:
            if filename in downgrade_allowed_list:
                warn("whitelisted downgrade rule in %s redirects to http." % filename)
            else:
                fail("non-whitelisted downgrade rule in %s redirects to http." % filename)
                return False
        elif to[:5] == "http:":
            fail("non-downgrade rule in %s redirects to http." % filename)
            return False
    return True

printable_characters = set(map(chr, list(range(32, 127))))

def test_non_ascii(tree, filename, from_attrib, to):
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
  test_unencrypted_to,
  test_non_ascii
]

failure = 0
seen_file = False

xpath_ruleset = etree.XPath("/ruleset")
xpath_ruleset_name = etree.XPath("/ruleset/@name")
xpath_ruleset_file = etree.XPath("/ruleset/@f")
xpath_host = etree.XPath("/ruleset/target/@host")
xpath_from = etree.XPath("/ruleset/rule/@from")
xpath_to = etree.XPath("/ruleset/rule/@to")

conn = sqlite3.connect(args.db)
c = conn.cursor()
for row in c.execute('''SELECT contents from rulesets'''):
    try:
        tree = etree.fromstring(row[0])
    except Exception as oops:
        failure = 1
        print("failed XML validity: %s\n" % (oops))
    if failure or not xpath_ruleset(tree):
        continue
    rn = xpath_ruleset_name(tree)[0]
    if not rn:
        failure = 1
        fail("unnamed ruleset")
        continue
    rf = xpath_ruleset_name(tree)[0]
    from_attrib = xpath_from(tree)
    to = xpath_to(tree)
    for test in tests:
        if not test(tree, rf, from_attrib=from_attrib, to=to):
            failure = 1
            fail("%s failed test: %s" % (rf, test.__doc__))

for (host, count) in c.execute('''
  select host, count(host) as c from targets group by host;'''):
    if count > 1:
        if host in duplicate_allowed_list:
            warn("Whitelisted hostname %s shows up in %d different rulesets." % (host, count))
        else:
            failure = 1
            fail("Hostname %s shows up in %d different rulesets." % (host, count))
    if not is_valid_target_host(host):
        failure = 1
        fail("%s failed: %s" % (host, is_valid_target_host.__doc__))

sys.exit(failure)
