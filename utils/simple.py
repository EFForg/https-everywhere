#!/usr/bin/env python2.7

from lxml import etree
import regex

# XXX: this doesn't work for from patterns that use the ?: in (?:www\.)?
#      (one of many examples in Zoosk.com.xml)
# XXX: this doesn't figure out if a target host causes a particular rule
#      to be completely inapplicable (in which case it should probably be
#      ignored) for determining simplicity
# XXX: this doesn't catch simple rules that use alternation with
#      backreferences, like from="^http://(foo|bar)\.example\.com/"
#      to="\1.example.com"

def simple(f):
    tree = etree.parse(f)
    targets = [target.attrib["host"] for target in tree.xpath("/ruleset/target")]
    return all([
    # ruleset must not be default_off
    "default_off" not in tree.xpath("/ruleset")[0].attrib,
    # ruleset must not contain a match_rule
    "match_rule" not in tree.xpath("/ruleset")[0].attrib,
    # XXX: maybe also check for platform="mixedcontent" here
    # ruleset must not apply any securecookie patterns
    not tree.xpath("/ruleset/securecookie"),
    # ruleset must not contain any exclusions
    not tree.xpath("/ruleset/exclusion"),
    # targets must not contain any wildcards
    not any("*" in target for target in targets),
    # and every rule must itself be simple according to the criteria below
    all(simple_rule(rule, targets) for rule in tree.xpath("/ruleset/rule"))
    ])

def simple_rule(rule, targets):
    """Is this rule a simple rule?  A simple rule rewrites a single hostname,
    perhaps with an optional leading www\., to itself or to itself plus www.,
    at the top level with no other effects."""
    rule_from = rule.attrib["from"]
    rule_to = rule.attrib["to"]
    # Simple rule with no capture
    if regex.match(r"^\^http://[-A-Za-z0-9.\\]+/$", rule_from):
        applicable_host = unescape(regex.search(r"^\^http://([-A-Za-z0-9.\\])+/$", rule_from).groups()[0])
        if regex.match(r"^https://%s/" % applicable_host, rule_to) or regex.match("r^https://%s/" % applicable_host, rule_to):
            return True
        else:
            return False
    # Optional www
    if regex.match(r"^\^http://\(www\\\.\)\?[-A-Za-z0-9.\\]+/$", rule_from):
        applicable_host = unescape(regex.search(r"^\^http://\(www\\\.\)\?([-A-Za-z0-9.\\]+)/$", rule_from).groups()[0])
        if regex.match(r"^https://www\.%s/" % applicable_host, rule_to) or regex.match(r"^https://%s/" % applicable_host, rule_to):
            return True
        else:
            return False
    return False

def unescape(s):
    return s.replace(r"\.", ".")
