#!/usr/bin/env python

import sys, re, os
from lxml import etree

if len(sys.argv) > 1:
   try:
       os.chdir(sys.argv[1])
   except:
       sys.stderr.write("could not chdir to %s\n" % sys.argv[1])
       sys.stderr.write("usage: %s directoryname\n" % sys.argv[0])
       sys.exit(2)

def test_not_anchored(tree):
    # Rules not anchored to the beginning of a line.
    for f in tree.xpath("/ruleset/rule/@from"):
        if not f or f[0] != "^":
            return False
    return True

def test_bad_regexp(tree):
    # Rules with invalid regular expressions.
    for f in tree.xpath("/ruleset/rule/@from"):
        try:
            re.compile(f)
        except:
            return False
    return True

def test_unescaped_dots(tree):
    # XXX Rules containing unescaped dots outside of brackets and before slash.
    # XXX TODO FIXME UNIMPLEMENTED
    # was:
    # if grep from= *.xml | cut -d\" -f2 | sed 's/\[[^]]*\]//g' | egrep 'http.?.?://[^/]*[^\]\.[^*]'
    return True

def test_space_in_to(tree):
    for t in tree.xpath("/ruleset/rule/@to"):
        if ' ' in t:
            return False
    return True

def test_unencrypted_to(tree):
    # Rules that redirect to something other than https.
    # This used to test for http: but testing for lack of https: will
    # catch more kinds of mistakes.
    for t in tree.xpath("/ruleset/rule/@to"):
        if t[:6] != "https:":
            return False
    return True

def test_backslash_in_to(tree):
    # Rules containing backslashes in to pattern.
    for t in tree.xpath("/ruleset/rule/@to"):
        if '\\' in t:
            return False
    return True

def test_no_trailing_slash(tree):
    # Rules not containing trailing slash in from or to pattern.
    for r in tree.xpath("/ruleset/rule"):
        f, t = r.get("from"), r.get("to")
        if not re.search("//.*/", f):
            return False
        if not re.search("//.*/", t):
            return False
    return True

def test_lacks_target_host(tree):
    # Rules that lack at least one target host (target tag with host attr).
    return not not tree.xpath("/ruleset/target/@host")

def test_bad_target_host(tree):
    # Rules where a target host contains multiple wildcards or a slash.
    for target in tree.xpath("/ruleset/target/@host"):
        if "/" in target:
            return False
        if target.count("*") > 1:
            return False
    return True

def test_duplicated_target_host(tree):
    # Rules where a single target host appears more than once.
    targets = tree.xpath("/ruleset/target/@host")
    return len(set(targets)) == len(targets)

# TODO: duplicated ruleset names across rules with /ruleset/@name
# TODO: rules containing non-ASCII characters
# TODO: exclusion pattern and secure cookie regexp validity tests


tests = [test_not_anchored, test_bad_regexp, test_unescaped_dots,
         test_space_in_to, test_unencrypted_to, test_backslash_in_to,
         test_no_trailing_slash, test_lacks_target_host, test_bad_target_host,
         test_duplicated_target_host]

failure = 0
seen_file = False

for fi in os.listdir("."):
    if fi[-4:] != ".xml": continue
    try:
       tree = etree.parse(fi)
       seen_file = True
    except Exception, oops:
       failure = 1
       sys.stdout.write("%s failed XML validity: %s\n" % (fi, oops))
    ruleset_name = tree.xpath("/ruleset/@name")[0]
    for test in tests:
        if not test(tree):
            failure = 1
            sys.stdout.write("%s failed test %s\n" % (fi, test))

if not seen_file:
   sys.stdout.write("There were no valid XML files in the current or ")
   sys.stdout.write("specified directory.\n")
   failure = 3

sys.exit(failure)
