#!/usr/bin/env python2.7

import sys
import re
from functools import partial

try:
    from lxml import etree
except ImportError:
    sys.stderr.write("** Could not import lxml!  Rule validation SKIPPED.\n")
    sys.stderr.write("** Caution: A resulting build MAY CONTAIN INVALID RULES.\n")
    sys.stderr.write("** Please install libxml2 and lxml to permit validation!\n")
    sys.exit(0)

try:
    from requests import head
    from requests.exceptions import SSLError, ConnectionError, Timeout
except ImportError:
    sys.stderr.write("** Could not import requests!  Rule validation SKIPPED.\n")
    sys.stderr.write("** Caution: A resulting build MAY CONTAIN SITES WHICH DO NOT SUPPORT HTTPS.\n")
    sys.stderr.write("** Please install requests to permit validation!\n")
    sys.exit(0)

if not (sys.argv[1:] and sys.argv[2:]):
    sys.stderr.write("Usage: %s ruleset report_file\n\n" % sys.argv[0])
    sys.exit(0)

# Error lists
certificate = []
timeout = []
redirect = []

ruleset = sys.argv[1]
report_file = sys.argv[2]

request = partial(head, verify=True, timeout=15.0,
        config={'keep_alive': False})
# 'GET' - method, verify - verify the certificate, timeout - 5.0 seconds

def test_response_no_redirect(to):
    """destination may not support HTTPS."""
    ret = True
    try:
        response = request(to, allow_redirects=False)
        if response.status_code in (300, 301, 302, 307, 308):
            find_redirect(to)
            ret = False
        if response.status_code != 200:
            ret = False
        del response
    except SSLError:
    #   sys.stdout.write("failure: %s certificate validity check failed.\n" % to)
        certificate.append(to)
        ret = False
    except (ConnectionError, Timeout):
    #   sys.stdout.write("failure: %s can not be reached.\n" % to)
        timeout.append('%s - timeout' % to)
        ret = False
    except Exception:
        ret = False
    return ret


def find_redirect(to):
    """Prints redirects"""
    try:
        response = request(to, allow_redirects=True)
        url_re = re.compile(re.escape(to))
        if response.status_code == 200 and not url_re.match(response.url):
            # i.e. it redirected and it didn't redirect from something like:
            #  https://www.eff.org/ -> https://www.eff.org/index.html
        #   sys.stdout.write("failure: %s redirects to %s.\n" % (to, response.url))
            redirect.append('%s -> %s' % (to, response.url))
    except SSLError:
        redirect.append('%s - ssl_error' % to)
    except (ConnectionError, Timeout):
    #   sys.stdout.write("failure: %s can not be reached to complete a redirect\n" % to)
        redirect.append('%s - timeout' % to)
    except Exception:
        pass


failure = 0
#failed = []
back_ref = re.compile('\$\d+')

if __name__ == "__main__":
    tree = etree.parse(ruleset)

    seen = []
    for rule in tree.xpath('/ruleset/rule'):
        to = rule.get('to')
        if back_ref.search(to):
            continue
        if not test_response_no_redirect(to):
            #failed.append(to)
            failure = 1
        seen.append(to)

    if failure:
        sys.stdout.write("warning: %s failed test: %s\n" % (ruleset, test_response_no_redirect.__doc__))
        with open(report_file, 'a') as fd:
            #fd.write('%s: %s\n' % (ruleset, ', '.join(failed)))
            if certificate:
                fd.write('[%s] Certificate Errors:\n %s\n' %
                        (ruleset, ', '.join(certificate)))
            if redirect:
                fd.write('[%s] Redirect Failures:\n %s\n' %
                        (ruleset, ', '.join(redirect)))
            if timeout:
                fd.write('[%s] Timeout Failures:\n %s\n' %
                        (ruleset, ', '.join(timeout)))

    sys.exit(failure)
