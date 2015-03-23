#!/usr/bin/python2.7

import argparse
import sys, re, os

try:
    from lxml import etree
except ImportError:
    sys.stderr.write("** Could not import lxml!  Rule validation SKIPPED.\n")
    sys.stderr.write("** Caution: A resulting build MAY CONTAIN INVALID RULES.\n")
    sys.stderr.write("** Please install libxml2 and lxml to permit validation!\n")
    sys.exit(0)

parser = argparse.ArgumentParser(
    formatter_class=argparse.RawDescriptionHelpFormatter,
    description="Ruleset validation script.")
parser.add_argument('--ignoredups', type=str, nargs="*",
    default="",
    help="Ignore entries."
    )
parser.add_argument('--dupdir', type=str, nargs="*",
    default="",
    help="Duplicate directory."
    )
parser.add_argument('--quiet', action="store_true",
    default=False, help="Suppress debug output."
    )
parser.add_argument('ruleset', metavar='XML directory', type=str, nargs="*",
    default="src/chrome/content/rules",
    help='Directory of XML files to validate.')

args = parser.parse_args()

ignoredups = [re.compile(val) for val in args.ignoredups]
dupdir = [val for val in args.dupdir]
quiet = args.quiet

def warn(s):
    if not quiet: sys.stdout.write("warning: %s\n" % s)

def fail(s):
    sys.stdout.write("failure: %s\n" % s)

def test_not_anchored(tree):
    # Rules not anchored to the beginning of a line.
    """The 'from' rule is not anchored to beginning of line using the ^ symbol."""
    for f in tree.xpath("/ruleset/rule/@from"):
        if not f or f[0] != "^":
            return False
    return True

def test_bad_regexp(tree):
    # Rules with invalid regular expressions.
    """The 'from' rule contains an invalid extended regular expression."""
    for f in tree.xpath("/ruleset/rule/@from") + \
             tree.xpath("/ruleset/exclusion/@pattern") + \
             tree.xpath("/ruleset/securecookie/@host"):
        try:
            re.compile(f)
        except:
            return False
    return True

def test_missing_to(tree):

    # Rules that are terminated before setting 'to'.
    # These cases are probably either due to a misplaced
    # rule end or intended to be different elements.
    """Rule is missing a 'to' value."""
    for rule in tree.xpath("/ruleset/rule"):
	if not rule.get("to"):
            warn("'to' attribute missing in %s. " %fi)
            warn("Misplaced end or misnamed element?")
            return False
    return True

def test_unescaped_dots(tree):
    # Rules containing unescaped dots outside of brackets and before slash.
    # Note: this is meant to require example\.com instead of example.com,
    # but it also forbids things like .* which usually ought to be replaced
    # with something like ([^/:@\.]+)
    """The 'from' rule contains unescaped period in regular expression.  Try escaping it with a backslash."""
    for f in tree.xpath("/ruleset/rule/@from"):
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

def test_space_in_to(tree):
    # Rules where the to pattern contains a space.
    """The 'to' rule contains a space."""
    for t in tree.xpath("/ruleset/rule/@to"):
        if ' ' in t:
            return False
    return True

def test_unencrypted_to(tree):
    # Rules that redirect to something other than https or http.
    # This used to test for http: but testing for lack of https: will
    # catch more kinds of mistakes.
    # Now warn if the rule author indicates they intended it, with the
    # downgrade attribute.  Error if this attribute is not present.
    """Rule redirects to something other than https."""
    for rule in tree.xpath("/ruleset/rule"):
        to, downgrade = rule.get("to"), rule.get("downgrade")
        if to[:6] != "https:" and to[:5] != "http:":
            return False
        elif to[:5] == "http:" and downgrade:
            warn("downgrade rule in %s redirects to http." % fi)
        elif to[:5] == "http:":
            fail("non-downgrade rule in %s redirects to http." % fi)
            return False
    return True

def test_backslash_in_to(tree):
    # Rules containing backslashes in to pattern.
    """The 'to' rule contains a backslash."""
    for t in tree.xpath("/ruleset/rule/@to"):
        if '\\' in t:
            return False
    return True

def test_no_trailing_slash(tree):
    # Rules not containing trailing slash in from or to pattern.
    """Rule omits forward slash after host name."""
    for r in tree.xpath("/ruleset/rule"):
        f, t = r.get("from"), r.get("to")
        if not re.search("//.*/", f):
            return False
        if not re.search("//.*/", t):
            return False
    return True

def test_lacks_target_host(tree):
    # Rules that lack at least one target host (target tag with host attr).
    """Rule fails to specify at least one target host."""
    return not not tree.xpath("/ruleset/target/@host")

def test_bad_target_host(tree):
    # Rules where a target host contains multiple wildcards or a slash.
    """The target host must be a hostname, not URL, and must use at most one wildcard."""
    for target in tree.xpath("/ruleset/target/@host"):
        if "/" in target:
            return False
        if target.count("*") > 1:
            return False
    return True

def test_duplicated_target_host(tree):
    # Rules where a single target host appears more than once.
    """Rule contains the same target host more than once."""
    targets = tree.xpath("/ruleset/target/@host")
    return len(set(targets)) == len(targets)

printable_characters = set(map(chr, list(range(32, 127))))

def test_non_ascii(tree):
    # Rules containing non-printable characters.
    """Rule contains non-printable character in 'to' pattern."""
    for t in tree.xpath("/ruleset/rule/@to"):
        for c in t:
            if c not in printable_characters:
                return False
    return True

def test_ruleset_name(tree):
    """Rule has name"""
    if tree.xpath("/ruleset/@name"):
        return True
    else:
        return False

def get_all_names_and_targets(ds):
    """extract unique names and targets from a list of dirs of xml files"""
    names = set()
    targets = set()
    for d in ds:
        for fi in os.listdir(d):
            fi = os.path.join(d, fi)
            try:
                tree = etree.parse(fi)
                ruleset_name = tree.xpath("/ruleset/@name")[0]
                target_names = tree.xpath("/ruleset/target/@host")
            except Exception:
                continue
            names.add(ruleset_name)
            for target in target_names:
                targets.add(target)
    return names, targets

def nomes_all(where=sys.argv[1:]):
    """Returns generator to extract all files from a list of files/dirs"""
    if not where: where=['.']
    for i in where:
        if os.path.isfile(i):
            yield i
        elif os.path.isdir(i):
            for r, d, f in os.walk(i):
                for fi in f:
                    yield os.path.join(r, fi)

tests = [test_not_anchored, test_bad_regexp, test_unescaped_dots, test_missing_to,
         test_space_in_to, test_unencrypted_to, test_backslash_in_to,
         test_no_trailing_slash, test_lacks_target_host, test_bad_target_host,
         test_duplicated_target_host, test_non_ascii]

failure = 0
seen_file = False
all_names, all_targets = get_all_names_and_targets(dupdir)

for fi in nomes_all():
    try:
        tree = etree.parse(fi)
        if fi[-4:] != ".xml":
            if tree.xpath("/ruleset"):
                warn("ruleset in file without .xml extension: %s" % fi)
            else:
                continue
        seen_file = True
    except Exception as oops:
        if fi[-4:] != ".xml":
            continue
        failure = 1
        fail("%s failed XML validity: %s\n" % (fi, oops))
    if failure or not tree.xpath("/ruleset"):
        continue
    if not test_ruleset_name(tree):
        failure = 1
        fail("unnamed ruleset: %s" % fi)
        continue
    ruleset_name = tree.xpath("/ruleset/@name")[0]
    if ruleset_name in all_names:
        failure = 1
        fail("duplicate ruleset name %s" % ruleset_name)
    all_names.add(ruleset_name)
    for test in tests:
        if not test(tree):
            failure = 1
            fail("%s failed test: %s" % (fi, test.__doc__))
    for target in tree.xpath("/ruleset/target/@host"):
        if target in all_targets and not any(ign.search(target) for ign in ignoredups):
            # suppress warning about duplicate targets if an --ignoredups
            # pattern matches target
            warn("%s has duplicate target: %s" % (fi, target))
        all_targets.add(target)

if not seen_file:
   which = "specified" if args else "current"
   sys.stdout.write("There were no valid XML files in the %s " % which)
   sys.stdout.write("directory.\n")
   failure = 3

sys.exit(failure)
