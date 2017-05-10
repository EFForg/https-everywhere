#!/usr/bin/env python2.7
from datetime import date
import json
import re

# Set the version in manifest.json to one based on today's date.
# Set the version in install.rdf and about.xul to one specified on the command
# line.

t = date.today()
f = open('chromium/manifest.json')
manifest = json.loads(f.read())
f.close()
manifest['version'] = `t.year` +'.'+ `t.month` +'.'+ `t.day`
f = open('chromium/manifest.json','w')
f.write(json.dumps(manifest,indent=4,sort_keys=True,separators=(',', ': ')))
