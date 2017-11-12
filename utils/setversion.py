#!/usr/bin/env python2.7
from datetime import date
import json


# Set the version in manifest.json to one based on today's date.

t = date.today()
version = `t.year` +'.'+ `t.month` +'.'+ `t.day`

f = open('chromium/manifest.json')
manifest = json.loads(f.read())
f.close()
manifest['version'] = version
f = open('chromium/manifest.json','w')
f.write(json.dumps(manifest,indent=4,sort_keys=True,separators=(',', ': ')))
