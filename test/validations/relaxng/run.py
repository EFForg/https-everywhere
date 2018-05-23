#!/usr/bin/env python3.6
# -*- encoding: utf-8 -*-

import argparse
import glob
import hashlib
import os

from lxml import etree

parser = argparse.ArgumentParser(description="Validate rulesets against relaxng schema.xml")
parser.add_argument("--source_dir", default="src/chrome/content/rules")
parser.add_argument("--https2https_whitelist", default="utils/ruleset-whitelist.csv")

args = parser.parse_args()

files = glob.glob(os.path.join(args.source_dir, "*.xml"))

relaxng_doc = etree.parse("test/validations/relaxng/schema.xml")
relaxng = etree.RelaxNG(relaxng_doc)

relaxng_doc_https2https = etree.parse("test/validations/relaxng/schema_https2https.xml")
relaxng_https2https = etree.RelaxNG(relaxng_doc_https2https)

https2https_whitelist = {}

with open(args.https2https_whitelist) as f:
    f.readline()
    for line in f:
        fileHash, _, _, fileSkip, fileName = line.strip().split(",")
        if fileSkip == "1":
            https2https_whitelist[fileName] = fileHash

exit_code = 0

print("Validation of rulesets against relaxng schema.xml begins...")

for filename in sorted(files):
    tree = etree.parse(filename)

    basename = os.path.basename(filename)

    ruleset_relaxng = relaxng

    if basename in https2https_whitelist:
        with open(filename, "rb") as file:
            if hashlib.sha256(file.read()).hexdigest() == https2https_whitelist[basename]:
                ruleset_relaxng = relaxng_https2https

    if not ruleset_relaxng.validate(tree):
        exit_code = 1
        e = ruleset_relaxng.error_log.last_error
        print("{} {}:{}:{}: {}".format(e.level_name, e.filename, e.line, e.column, e.message))

if exit_code == 0:
    print("Validation of rulesets against relaxng schema.xml succeeded.")
else:
    print("Validation of rulesets against relaxng schema.xml failed.\n\n" \
          "Two very common reasons for this are the following:\n" \
          " - missing caret (^) in \"from\" attribute: it should be \"^http:\" and not \"http:\"\n" \
          " - missing trailing slashes in \"from\" or \"to\" when specifying full hostnames: \n" \
          "   it should be \"https://eff.org/\" and not \"https://eff.org\"\n")

exit(exit_code)
