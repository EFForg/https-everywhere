#!/usr/bin/env python2.7

# Merge all the .xml rulesets into a single "default.rulesets" file -- this
# prevents inodes from wasting disk space, but more importantly, works around
# the fact that zip does not perform well on a pile of small files.

# currently a very literal translation of merge-rulesets.sh, but about five
# times faster
from __future__ import print_function
pass
import os
from glob import glob
from subprocess import call
import sys
import traceback
import re
import unicodedata


def normalize(f):
    """
    OSX and Linux filesystems encode composite characters differently in filenames.
    We should normalize to NFC: http://unicode.org/reports/tr15/.
    """
    f = unicodedata.normalize('NFC', unicode(f, 'utf-8')).encode('utf-8')
    return f

os.chdir("src")
rulesets_fn="chrome/content/rules/default.rulesets"
xml_ruleset_files = map(normalize, glob("chrome/content/rules/*.xml"))

# cleanup after bugs :/
misfile = rulesets_fn + "r"
if os.path.exists(misfile):
  print("Cleaning up malformed rulesets file...")
  os.unlink(misfile)

if "--fast" in sys.argv:
  library_compiled_time = os.path.getmtime(rulesets_fn)
  newest_xml = max([os.path.getmtime(f) for f in xml_ruleset_files])
  if library_compiled_time >= newest_xml:
    print("Library is newer that all rulesets, skipping rebuild...")
    sys.exit(0)

print("Creating ruleset library...")

# Under git bash, sed -i issues errors and sets the file "read only".  Thanks.
if os.path.isfile(rulesets_fn):
  os.system("chmod u+w " + rulesets_fn)

def rulesize():
  return len(open(rulesets_fn).read())

def clean_up(rulefile):
    """Remove extra whitespace and comments from a ruleset"""
    comment_and_newline_pattern = re.compile(r"<!--.*?-->|\n|\r", flags=re.DOTALL)
    rulefile = comment_and_newline_pattern.sub('', rulefile)
    to_and_from_pattern = re.compile(r'\s*(from=)')
    rulefile = to_and_from_pattern.sub(r' \1', rulefile)
    rulefile = re.sub(r'"\s*(to=)', r'" \1', rulefile)
    rulefile = re.sub(r">\s*<", r"><", rulefile)
    rulefile = re.sub(r"</ruleset>\s*", r"</ruleset>\n", rulefile)
    rulefile = re.sub(r"\s*(/>|<ruleset)", r"\1", rulefile)
    return rulefile

library = open(rulesets_fn,"w")

try:
  commit_id = os.environ["GIT_COMMIT_ID"]
  library.write('<rulesetlibrary gitcommitid="%s">' % commit_id)
except:
  # Chromium
  library.write('<rulesetlibrary>')

# Include the filename.xml as the "f" attribute
print("Removing whitespaces and comments...")

for rfile in sorted(xml_ruleset_files):
  ruleset = open(rfile).read()
  fn = os.path.basename(rfile)
  ruleset = ruleset.replace("<ruleset", '<ruleset f="%s"' % fn, 1)
  library.write(clean_up(ruleset))
library.write("</rulesetlibrary>\n")
library.close()

try:
  if 0 == call(["xmllint", "--noout", rulesets_fn]):
    print(rulesets_fn, "passed XML validity test.")
  else:
    print("ERROR:", rulesets_fn, "failed XML validity test!")
    sys.exit(1)
except OSError as e:
  if "No such file or directory" not in traceback.format_exc():
    raise
  print("WARNING: xmllint not present; validation of", rulesets_fn, " skipped.")

# We make default.rulesets at build time, but it shouldn't have a variable
# timestamp
call(["touch", "-r", "install.rdf", rulesets_fn])

