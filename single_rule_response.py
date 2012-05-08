#!/usr/bin/env python

import sys, os, re
from functools import partial

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

if not (sys.argv[1:] and sys.argv[2:]):
    sys.stderr.write("Usage: %s ruleset report_file\n\n" % sys.argv[0])
    sys.exit(0)

ruleset = sys.argv[1]
report_file = sys.argv[2]

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

failure = 0
failed = []
back_ref = re.compile('\$\d+')

if __name__ == "__main__":
    tree = etree.parse(ruleset)

    seen = []
    for rule in tree.xpath('/ruleset/rule'):
        to = rule.get('to')
        if rule.get('downgrade') or to in seen:
            continue
        if back_ref.search(to):
            continue
        if not test_response_no_redirect(to):
            failed.append(to)
            failure = 1
        seen.append(to)

    if failure:
        sys.stdout.write("warning: %s failed test: %s\n" % (ruleset, test_response_no_redirect.__doc__))
        with open(report_file, 'a') as fd:
            fd.write('%s: %s\n' % (ruleset, ', '.join(failed)))

    sys.exit(failure)
