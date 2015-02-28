#!/usr/bin/python2.7
"""
Help automate the process of generating test URLs for rulesets.

Many rulesets have complicated regexes like this:

^http://s3(?:-website)?(-ap-(?:nor|sou)theast-1|-(?:eu|us)-west-\d|-external-\d|-sa-east-1)?\.amazonaws\.com/

Under the new requirements for ruleset coverage testing, we need a test URL that
covers each of these branches. Fortunately, the exrex library can automate
expanding the branches of the regex. This script uses that library to generate a
set of plausible test URLs. NOTE: Usually these test URLs will need manual
verification. Some may not actually exist. Also, if a URL contains a wildcard,
e.g. '.', exrex will attempt to substitute all possible values, creating an
explosion of test URLs. We attempt to detect this by finding regexes that
generate more than a thousand test URLs, and not printing any output for those.
You will have to manually find test cases for URLs with broad wildcards.

Usage:

./utils/test-generator.py src/chrome/content/rules/AmazonAWS.xml
# ... Paste output into your ruleset ...
# Then test the ruleset:
python2.7 https-everywhere-checker/src/https_everywhere_checker/check_rules.py \
    https-everywhere-checker/manual.checker.config
    src/chrome/content/rules/AmazonAWS.xml
"""

import exrex
import lxml
from lxml import etree
import sys

def generate(regex):
    i = 0
    urls = []
    for url in exrex.generate(regex):
        i += 1
        if i > 1000:
            break
        urls.append(url)
    if i <= 1000:
        for url in urls:
            print "<test url=\"%s\" />" % url

for xmlFname in sys.argv[1:]:
    ruleset = etree.parse(file(xmlFname)).getroot()
    xpath_from = etree.XPath("/ruleset/rule/@from")
    for from_attrib in xpath_from(ruleset):
        generate(from_attrib)
    xpath_exclusion = etree.XPath("/ruleset/exclusion/@pattern")
    for pattern_attrib in xpath_exclusion(ruleset):
        generate(pattern_attrib)
