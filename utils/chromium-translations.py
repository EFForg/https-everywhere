#!/usr/bin/env python3.6
"""
Given two directories, copy Firefox-style https-everywhere.dtd translations
from the first directory into appropriately-named Chromium-style messages.json
translations in the second directory.
"""
import re
import sys
import os
import json

SOURCE_DIR = sys.argv[1]
DEST_DIR = sys.argv[2]

MESSAGE_REGEX = re.compile(r"<!ENTITY https-everywhere\.([\w.-]+) \"(.*?)\">")


def convert(locale):
    """convert"""
    target_messages = {}
    with open(os.path.join(SOURCE_DIR, locale, "https-everywhere.dtd"), 'r',
              encoding='utf-8') as f_l:
        for line in f_l:
            m_re = MESSAGE_REGEX.search(line)
            if m_re:
                message_name = m_re.group(1)
                message_value = m_re.group(2)
                message_name = re.sub("[.-]", "_", message_name)
                target_messages[message_name] = {
                    "message": message_value
                }
    target_dir = os.path.join(DEST_DIR, locale)
    if not os.path.isdir(target_dir):
        os.mkdir(target_dir)
    with open(os.path.join(target_dir, "messages.json"), "w") as out_file:
        out_file.write(json.dumps(target_messages, sort_keys=True, indent=4))


for locale in os.listdir(SOURCE_DIR):
    if not "." in locale:
        convert(locale)
