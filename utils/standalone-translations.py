#!/usr/bin/env python3.6
"""
Generate a messages.json translations file for HTTPS Everywhere Standalone
"""
import re
import sys
import os
import json

source_dir = sys.argv[1]
dest_dir = sys.argv[2]

message_regex = re.compile("<!ENTITY https-everywhere\.([\w.-]+) \"(.*?)\">")
strings_needed = [
  "about.version",
  "about.rulesets_version",
  "menu.globalDisable",
  "menu.globalEnable",
  "menu.encryptAllSitesEligibleOn",
  "menu.encryptAllSitesEligibleOff",
  "options.enterDisabledSite",
  "options.addDisabledSite",
  "options.hostNotFormattedCorrectly",
  "options.disabledUrlsListed",
  "menu.httpNoWhereExplainedBlocked",
  "menu.httpNoWhereExplainedAllowed",
  "standalone.proxy_server_info_prefix",
  "standalone.transparent_true",
  "standalone.transparent_false",
]

def convert(locale):
  translation_file = os.path.join(source_dir, locale, "https-everywhere.dtd")
  if os.path.isfile(translation_file):
    target_messages = {}
    with open(translation_file, 'r', encoding='utf-8') as f:
      for line in f:
        m = message_regex.search(line)
        if m:
          message_name = m.group(1)
          if message_name in strings_needed:
            message_value = m.group(2)
            message_name = re.sub("[.-]", "_", message_name)
            target_messages[message_name] = message_value
    return target_messages
  else:
    return False

with open(os.path.join(dest_dir, "messages.json"), "w") as out_file:
  all_target_messages = {}
  for locale in os.listdir(source_dir):
    if not "." in locale:
      target_messages = convert(locale)
      if target_messages:
        all_target_messages[locale] = target_messages
  out_file.write(json.dumps(all_target_messages, sort_keys=True, indent=4))
