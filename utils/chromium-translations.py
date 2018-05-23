#!/usr/bin/env python3.6
"""
Given two directories, copy Firefox-style https-everywhere.dtd translations from
the first directory into appropriately-named Chromium-style messages.json
translations in the second directory.
"""
import re
import sys
import os
import json

source_dir = sys.argv[1]
dest_dir = sys.argv[2]

message_regex = re.compile("<!ENTITY https-everywhere\.([\w.-]+) \"(.*?)\">")

def convert(locale):
  target_messages = {}
  with open(os.path.join(source_dir, locale, "https-everywhere.dtd"), 'r', encoding='utf-8') as f:
    for line in f:
      m = message_regex.search(line)
      if m:
        message_name = m.group(1)
        message_value = m.group(2)
        message_name = re.sub("[.-]", "_", message_name)
        target_messages[message_name] = {
          "message": message_value
        }
  target_dir = os.path.join(dest_dir, locale)
  if not os.path.isdir(target_dir):
    os.mkdir(target_dir)
  with open(os.path.join(target_dir, "messages.json"), "w") as out_file:
    out_file.write(json.dumps(target_messages, sort_keys=True, indent=4))

for locale in os.listdir(source_dir):
  if not "." in locale:
      convert(locale)
