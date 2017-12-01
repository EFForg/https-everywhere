#!/usr/bin/env python2.7

import sys
import re
from subprocess import Popen, PIPE

host_targets = re.compile(r'<target *host="([a-z0-9\-\*\.]+)"')
wget_cmd = lambda h : ["wget", "-O", "/dev/null", "https://" + h]

for fname in sys.argv[1:]:
  hosts = host_targets.findall(open(fname).read())
  if not hosts:
    print("Could not find <target hosts> in " + fname)
    continue
  successes = []
  failures = []
  for h in hosts:
    h2 = h.replace("*", "www")
    cmd = Popen(wget_cmd(h2), stdout=PIPE, stderr=PIPE)
    out, err = cmd.communicate()
    for l in err.split("\n"):
      if "certificate" in l:
        failures.append(l)
        break
    else:
      successes.append(h)
  if successes and not failures:
    print(fname + " no cert warnings")
  elif failures and not successes:
    print(fname + " categorical failure:")
    for f in failures:
      print("    " + f)
  else:
    print(fname + " mixed results:")
    for s in successes:
      print("    " + s + " is OK")
    for f in failures:
      print("    " + f)

