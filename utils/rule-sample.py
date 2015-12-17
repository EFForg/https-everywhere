#!/usr/bin/env python

import glob
import random
rulefiles = glob.glob("src/chrome/content/rules/*.xml")
rulefiles.sort() # determinism
random.seed(0)
count = 0 

while count < 20:
  f = random.choice(rulefiles)
  ruleset = open(f).read()
  if "default_off" in ruleset or 'platform="mixedcontent' in ruleset:
    print "skipping", f
    continue
  count += 1
  print "-----------------------------------------------"
  print ruleset

