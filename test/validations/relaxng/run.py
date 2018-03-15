#!/usr/bin/env python3.6
# -*- encoding: utf-8 -*-

import argparse
import glob
import os

from lxml import etree

# commandline arguments parsing (nobody use it, though)
parser = argparse.ArgumentParser(description="Validate rulesets against relaxng schema.xml")
parser.add_argument("--source_dir", default="src/chrome/content/rules")

args = parser.parse_args()

# XML ruleset files
files = glob.glob(os.path.join(args.source_dir, "*.xml"))

# read the schema file
relaxng_doc = etree.parse('test/validations/relaxng/schema.xml')
relaxng = etree.RelaxNG(relaxng_doc)

exit_code = 0

print("Validation of rulesets against relaxng schema.xml begins...")

for filename in sorted(files):
    tree = etree.parse(filename)

    if not relaxng.validate(tree):
        exit_code = 1
        e = relaxng.error_log.last_error
        print("{} {}:{}:{}: {}".format(e.level_name, e.filename, e.line, e.column, e.message))

if exit_code == 0:
    message = "Validation of rulesets against relaxng schema.xml succeeded."
else:
    message = "\nTwo very common reasons for this are the following:\n" \
              " - missing caret (^) in 'from' attribute: it should be \"^http:\" and not \"http:\"\n" \
              " - missing trailing slashes in 'from' or 'to' when specifying full hostnames: \n" \
              "   it should be \"https://eff.org/\" and not \"https://eff.org\"\n\n" \
              "Validation of rulesets against relaxng schema.xml failed."

print(message)
exit(exit_code)
