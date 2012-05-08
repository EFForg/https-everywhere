#!/usr/bin/env python

import sys, os, re
from functools import partial
from collections import defaultdict

try:
    from lxml import etree
except ImportError:
    sys.stderr.write("** Could not import lxml!  Rule validation SKIPPED.\n")
    sys.stderr.write("** Caution: A resulting build MAY CONTAIN INVALID RULES.\n")
    sys.stderr.write("** Please install libxml2 and lxml to permit validation!\n")
    sys.exit(0)

try:
    from requests import request
    from requests.exceptions import SSLError, ConnectionError, Timeout
except ImportError:
    sys.stderr.write("** Could not import requests!  Rule validation SKIPPED.\n")
    sys.stderr.write("** Caution: A resulting build MAY CONTAIN SITES WHICH DO NOT SUPPORT HTTPS.\n")
    sys.stderr.write("** Please install requests to permit validation!\n")
    sys.exit(0)

if sys.argv[1:]:
    os.chdir(sys.argv[1])

req = partial(request, 'GET', verify=True, timeout=5.0)
# 'GET' - method, verify - verify the certificate, timeout - 5.0 seconds

def test_response_no_redirect(to):
    """Ruleset contains a destination which may not support HTTPS."""
    try:
        response = req(to, allow_redirects=False)
    except SSLError:
        sys.stdout.write("failure: %s certificate validity check failed.\n" % to)
        return False
    except (ConnectionError, Timeout):
        sys.stdout.write("failure: %s can not be reached.\n" % to)
        return False
    if response.status_code != 200:
        return find_redirect(to)
    return True


def find_redirect(to):
    """Prints redirects"""
    try:
        response = req(to, allow_redirects=True)
    except SSLError:
        return False
    except (ConnectionError, Timeout):
        sys.stdout.write("failure: %s can not be reached to complete a redirect\n" % to)
        return False
    url_re = re.compile(re.escape(to))
    if response.status_code == 200 and not url_re.match(response.url):
        sys.stdout.write("failure: %s redirects to %s.\n" % (to, response.url))
        return False
    return True


def write_failures():
    """Write the list of failures to a report."""
    with open('response_report.txt', 'w+') as fd:
        fd.truncate(0) # Erase the old report.
        for f in failed:
            fd.write("%s: %s\n", f, ', '.join(failed[f]))


default_off = 0
failure = 0
rule_failed = 0
back_ref = re.compile('\$\d+')
failed = defaultdict(list)

for fil in os.listdir('.'):
    if 'mismatches' in fil:
        continue
    try:
        tree = etree.parse(fil)

        if tree.xpath('/ruleset/@default_off'):
            default_off += 1
            continue
    except Exception, e:
        continue

    seen = []
    for rule in tree.xpath('/ruleset/rule'):
        to = rule.get('to')
        if rule.get('downgrade') or to in seen:
            continue
        if back_ref.search(to):
            continue
        if not test_response_no_redirect(to):
            failed[fil].append(to)
            rule_failed = 1
            failure = 1
        seen.append(to)

    if rule_failed:
        sys.stdout.write("warning: %s failed test: %s\n" % (fil, test_response_no_redirect.__doc__))
        rule_failed = 0

write_failures()

sys.stdout.write("Skipped %d default_off rulesets.\n" % default_off)

sys.exit(failure)
