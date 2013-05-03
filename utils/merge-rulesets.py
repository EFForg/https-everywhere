#!/usr/bin/env python

# Merge all the .xml rulesets into a single "default.rulesets" file -- this
# prevents inodes from wasting disk space, but more importantly, works around
# the fact that zip does not perform well on a pile of small files.

# currently a very literal translation of merge-rulesets.sh, but about five
# times faster

import os
from glob import glob
from subprocess import call
import sys
import traceback
import re

os.chdir("src")
rulesets_fn="chrome/content/rules/default.rulesets"

# cleanup after bugs :/
misfile = rulesets_fn + "r"
if os.path.exists(misfile):
  print("Cleaning up malformed rulesets file...")
  os.unlink(misfile)

print("Creating ruleset library...")

# Under git bash, sed -i issues errors and sets the file "read only".  Thanks.
if os.path.isfile(rulesets_fn):
  os.system("chmod u+w " + rulesets_fn)

library = open(rulesets_fn,"w")

# XXX TODO replace all sed commands with native Python
#strip_oneline_comment = re.compile(r"<!--.*?-->")

try:
  commit_id = os.environ["GIT_COMMIT_ID"]
  library.write('<rulesetlibrary gitcommitid="%s">' % commit_id)
except:
  # Chromium
  library.write('<rulesetlibrary>')

# Include the filename.xml as the "f" attribute
for rfile in sorted(glob("chrome/content/rules/*.xml")):
  ruleset = open(rfile).read()
  fn=os.path.basename(rfile)
  ruleset = ruleset.replace("<ruleset", '<ruleset f="%s"' % fn, 1)
  library.write(ruleset)
library.write("</rulesetlibrary>\n")
library.close()

print("Removing whitespaces and comments...")

def rulesize():
  return len(open(rulesets_fn).read())

crush = rulesize()
sedcmd = ["sed", "-i", "-e", ":a", "-re"]
call(sedcmd + [r"s/<!--.*?-->//g;/<!--/N;//ba", rulesets_fn])
call(["sed", "-i", r":a;N;$!ba;s/\n//g;s/>[ 	]*</></g;s/[ 	]*to=/ to=/g;s/[ 	]*from=/ from=/g;s/ \/>/\/>/g", rulesets_fn])
call(["sed", "-i", r"s/<\/ruleset>/<\/ruleset>\n/g", rulesets_fn])
print(("Crushed", crush, "bytes of rulesets into", rulesize()))

try:
  if 0 == call(["xmllint", "--noout", rulesets_fn]):
    print((rulesets_fn, "passed XML validity test."))
  else:
    print(("ERROR:", rulesets_fn, "failed XML validity test!"))
    sys.exit(1)
except OSError as e:
  if "No such file or directory" not in traceback.format_exc():
    raise
  print(("WARNING: xmllint not present; validation of", rulesets_fn, " skipped."))

# We make default.rulesets at build time, but it shouldn't have a variable
# timestamp
call(["touch", "-r", "chrome/content/rules", rulesets_fn])

