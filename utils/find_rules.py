#!/usr/bin/env python2.7
"""
Copyleft 2013 Osama Khalid.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This tool extracts HTTPSEverywhere rulesets and converts any given URL
to the secure version if it exists, or it returns None.  Here is a
sample:

  >>> import find_rules
  >>> replacer = find_rules.FindRules("/path/to/default.rulesets")
  >>> replacer.find("http://en.wikipedia.org/")
  'https://en.wikipedia.org/'
  >>> replacer.find("http://en.wikipedi.org/") # With a typo
  >>>
"""

import re
import xml.etree.ElementTree as ET

class FindRules:
    def __init__(self, filename):
        self.extract_rulesets(filename)

    def verify_target(self, target, host):
        matching_target = target.strip("*.")
        matching_target = matching_target.strip(".*")
        if target.startswith("*."):
            if host.endswith(matching_target):
                #print target, "matches", host
                return True
        elif target.endswith(".*"):
            if host.startswith(matching_target):
                #print target, "matches", host
                return True
        else:
            if host == matching_target:
                #print target, "matches", host
                return True

    def convert_to_python(self, matching, replacement):
        """Instead of $1 that is used by Javascript,
        Python uses \1."""
        new_matching = matching.replace(")?", "|)") # to avoid "unmatched group" error
        new_replacement = re.sub(r"\$(\d)", r"\\g<\1>", replacement)
        return new_matching, new_replacement

    def extract_rulesets(self, filename):
        tree = ET.parse(filename)
        root = tree.getroot()

        self.dict = {}
        for child in root:
            if child.tag == "ruleset":
                if "default_off" in child.attrib:
                    continue
                ruleset_name = child.attrib['name']
                ruleset = child.getchildren()
                self.dict[ruleset_name] = {}
                self.dict[ruleset_name]['targets'] = []
                self.dict[ruleset_name]['rules'] = []
                self.dict[ruleset_name]['exclusions'] = []
                for rule in ruleset:
                    if rule.tag == "target":
                        self.dict[ruleset_name]['targets'].append(rule.attrib['host'])
                    if rule.tag == "rule":
                        self.dict[ruleset_name]['rules'].append((rule.attrib['from'], rule.attrib['to']))
                    if rule.tag == "exclusion":
                        self.dict[ruleset_name]['exclusions'].append(rule.attrib['pattern'])

    def find(self, url):
        hostname_regex = r"https?://([^/]+)"
        try: #Remove
            host = re.findall(hostname_regex, url)[0]
        except IndexError, e:
            print url
            raise IndexError, e

        # In HTTPSEverywhere, URLs must contain a '/'.
        if url.replace("http://", "").find("/") == -1:
            url += "/"

        for ruleset in self.dict:
            for target in self.dict[ruleset]['targets']:
                if self.verify_target(target, host):
                    for exclusion in self.dict[ruleset]['exclusions']:
                        if re.findall(exclusion, url):
                            return None
                    for rule in self.dict[ruleset]['rules']:
                        matching_regex = rule[0] # "from"
                        replacement_regex = rule[1] # "to"
                        new_matching, new_replacement = self.convert_to_python(matching_regex, replacement_regex)
                        try:
                            replace_url = re.sub(new_matching, new_replacement, url)
                        except re.error, e:
                            print new_matching, new_replacement, url
                            raise re.error, e
                        if url != replace_url:
                            return replace_url
        return None

if __name__ == "__main__":
    import sys
    filename = sys.argv[1]
    url = sys.argv[2]
    script = FindRules(filename)
    replaced_url = script.find(url)
    print replaced_url
