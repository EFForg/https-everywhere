#!/usr/bin/env python2.7
#
# Builds an sqlite DB containing all the rulesets, indexed by target.

import glob
import locale
import os
import sqlite3
import subprocess
import sys

from collections import Counter
from lxml import etree

# Explicitly set locale so sorting order for filenames is consistent.
# This is important for deterministic builds.
# https://trac.torproject.org/projects/tor/ticket/11630#comment:20
# It's also helpful to ensure consistency for the lowercase check below.
locale.setlocale(locale.LC_ALL, 'en_US.UTF-8')

conn = sqlite3.connect(os.path.join(os.path.dirname(__file__), '../src/defaults/rulesets.sqlite'))
c = conn.cursor()
c.execute('''DROP TABLE IF EXISTS rulesets''')
c.execute('''CREATE TABLE rulesets
             (id INTEGER PRIMARY KEY,
              contents TEXT)''')
c.execute('''DROP TABLE IF EXISTS targets''')
c.execute('''CREATE TABLE targets
             (host TEXT,
              ruleset_id INTEGER)''')
c.execute('''DROP TABLE IF EXISTS git_commit''')
c.execute('''CREATE TABLE git_commit
             (git_commit TEXT)''')

git_commit = subprocess.check_output("git rev-parse HEAD", shell=True).rstrip("\n")
c.execute('''INSERT INTO git_commit (git_commit) VALUES(?)''', (git_commit,))

parser = etree.XMLParser(remove_blank_text=True)

# Precompile xpath expressions that get run repeatedly.
xpath_host = etree.XPath("/ruleset/target/@host")
xpath_ruleset = etree.XPath("/ruleset")

# Sort filenames so output is deterministic.
filenames = sorted(glob.glob('src/chrome/content/rules/*'))

counted_lowercase_names = Counter([name.lower() for name in filenames])
most_common_entry = counted_lowercase_names.most_common(1)[0]
if most_common_entry[1] > 1:
    print("%s failed case-insensitivity testing." % (most_common_entry[0]))
    print("Rules exist with identical case-insensitive names, which breaks some filesystems.")
    sys.exit(1)

for fi in filenames:
    if fi.endswith('/00README') or fi.endswith('/make-trivial-rule') or fi.endswith('/default.rulesets'):
        continue

    if " " in fi:
        print("%s failed validity: Rule filenames cannot contain spaces" % (fi))
        sys.exit(1)
    if not fi.endswith('.xml'):
        print("%s failed validity: Rule filenames must end in .xml" % (fi))
        sys.exit(1)

    try:
        tree = etree.parse(fi, parser)
    except Exception as oops:
        print("%s failed XML validity: %s\n" % (fi, oops))
        sys.exit(1)

    # Remove comments to save space.
    etree.strip_tags(tree, etree.Comment)

    targets = xpath_host(tree)
    if not targets:
        print('File %s has no targets' % fi)
        sys.exit(1)

    # Strip out the target tags. These aren't necessary in the DB because
    # targets are looked up in the target table, which has a foreign key
    # pointing into the ruleset table.
    etree.strip_tags(tree, 'target')

    # Store the filename in the `f' attribute so "view source XML" for rules in
    # FF version can find it.
    xpath_ruleset(tree)[0].attrib["f"] = os.path.basename(fi).decode(encoding="UTF-8")

    c.execute('''INSERT INTO rulesets (contents) VALUES(?)''', (etree.tostring(tree),))
    ruleset_id = c.lastrowid
    for target in targets:
        c.execute('''INSERT INTO targets (host, ruleset_id) VALUES(?, ?)''', (target, ruleset_id))

conn.commit()
conn.execute("VACUUM")
conn.close()
