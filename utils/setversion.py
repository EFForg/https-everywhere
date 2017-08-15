#!/usr/bin/env python2.7
from datetime import date
import json
import re
import sys

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

def replace_in_file(from_re, to, filename):
    contents = open(filename).read()
    with open(filename, 'w') as outfile:
        outfile.write(re.sub(from_re, to, contents))

firefox_version = sys.argv[1]
replace_in_file('<em:version>.*</em:version>',
          '<em:version>' + firefox_version + '</em:version>',
          'src/install.rdf')

replace_in_file('(?s)(https-everywhere.about.version.*?<label>).*?</label>',
          '\g<1>' + firefox_version + '</label>',
          'src/chrome/content/about.xul')
