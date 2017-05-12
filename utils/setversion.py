#!/usr/bin/env python2.7
from datetime import date
import json
import re


# Set the version in manifest.json to one based on today's date.

t = date.today()
version = `t.year` +'.'+ `t.month` +'.'+ `t.day`

f = open('chromium/manifest.json')
manifest = json.loads(f.read())
f.close()
manifest['version'] = version
f = open('chromium/manifest.json','w')
f.write(json.dumps(manifest,indent=4,sort_keys=True,separators=(',', ': ')))


# Add a link to the current version in https-everywhere-updates.json

updates_hash = {
    "version": version,
    "update_link": "https://eff.org/files/https-everywhere-" + version + "-eff.xpi",
    "applications": {
        "gecko": {
            "strict_min_version": "52.0"
        }
    }
}

f = open('src/https-everywhere-updates.json')
updates = json.loads(f.read())
f.close()
updates['addons']['https-everywhere-eff@eff.org']['updates'].append(updates_hash);
f = open('src/https-everywhere-updates.json', 'w')
f.write(json.dumps(updates,indent=4,sort_keys=True,separators=(',', ': ')))
