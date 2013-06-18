#!/usr/bin/env python

# autogenerate sample versions of rules from Chromium browser's HSTS
# preload list (in the from-preloads/ directory)

import urllib.request, urllib.error, urllib.parse, re, glob, os
from lxml import etree

preloads = urllib.request.urlopen("https://src.chromium.org/viewvc/chrome/trunk/src/net/http/transport_security_state_static.h?content-type=text%2Fplain").read()
preloads = preloads.decode('utf-8')

def escape(s):
    return re.sub("\.", "\\.", s)

def get_targets():
    """extract unique targets from the set of https-e rulesets"""
    ruledir = "src/chrome/content/rules/"
    rules = [ruledir+fi for fi in os.listdir(ruledir) if fi.endswith(".xml")]
    targets = set()
    for fi in rules:
        tree = etree.parse(fi)
        targets.update(tree.xpath("/ruleset/target/@host"))
    return targets

def is_dup(rule, targets):
    """find if a rule is duplicated in the existing https-e rulesets"""
    if rule.lower() in map(lambda x: x.lower(), targets):
        return True
    else:
        wildcards = filter(lambda x: '*' in x, targets)
        for url in wildcards:
            url = re.escape(url)
            url = re.sub(r'\\\*', '.*', url)  # handle wildcards
            url = '^'+url+'$'
            if re.compile(url, re.I).search(rule):
                return True
            else:
                continue
        return False

def make_rule(name, hosts):
    output = """<!-- This rule was automatically generated based on an HSTS
     preload rule in the Chromium browser.  See
     https://src.chromium.org/viewvc/chrome/trunk/src/net/http/transport_security_state_static.h
     for the list of preloads.  Sites are added to the Chromium HSTS
     preload list on request from their administrators, so HTTPS should
     work properly everywhere on this site.

     Because Chromium and derived browsers automatically force HTTPS for
     every access to this site, this rule applies only to Firefox. -->\n"""
    output += '<ruleset name="%s" platform="firefox">\n' % name.capitalize()
    for h in hosts:
        output += '<target host="%s" />\n' % h

    output += "\n"

    for h in hosts:
        output += '<securecookie host="^%s$" name=".+" />\n' % escape(h)

    output += "\n"

    for h in hosts:
        output += '<rule from="^http://%s/" to="https://%s/" />\n' % (escape(h), h)

    output += "</ruleset>\n"
    open("from-preloads/%s.xml" % name.capitalize(), "w").write(output)

t = re.compile('&quot;, true')
preloads = list(filter(t.search,preloads.split("\n")))

preloads = [x.split('&quot;')[1] for x in preloads]
preloads = [re.sub('\\\\[0-9]*', '.', x) for x in preloads]
preloads = [re.sub('^\.', '', x) for x in preloads]

print("Found %d rules total in HSTS preloads list" % len(preloads))

#rules = [open(x).read() for x in glob.glob("src/chrome/content/rules/*.xml")]

targets = get_targets()

d = {}
for x in preloads:
    if is_dup(x, targets):
        print("Ignored existing domain", x)
        continue
    domain = ".".join(x.split(".")[-2:])
    d.setdefault(domain, []).append(x)

if not os.access("from-preloads", 0):
    os.mkdir("from-preloads")

for k in d:
    make_rule(k, d[k])

print("Please examine %d new rules in from-preloads/ directory." % len(d))
