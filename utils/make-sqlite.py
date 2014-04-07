#!/usr/bin/python2.7
#
# Builds an sqlite DB containing all the rulesets, indexed by target.

import subprocess
import sqlite3
import sys, re, os

from lxml import etree

def nomes_all(where=sys.argv[1:]):
    """Returns generator to extract all files from a list of files/dirs"""
    if not where: where=['.']
    for i in where:
        if os.path.isfile(i):
            yield i
        elif os.path.isdir(i):
            for r, d, f in os.walk(i):
                for fi in f:
                    yield os.path.join(r, fi)


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

for fi in nomes_all():
    try:
        tree = etree.parse(fi, parser)
    except Exception as oops:
        if fi[-4:] != ".xml":
            continue
        print("%s failed XML validity: %s\n" % (fi, oops))
    if not tree.xpath("/ruleset"):
        continue

    # Remove comments to save space.
    etree.strip_tags(tree,etree.Comment)

    targets = tree.xpath("/ruleset/target/@host")
    # Strip out the target tags. These aren't necessary in the DB because
    # targets are looked up in the target table, which has a foreign key
    # pointing into the ruleset table.
    etree.strip_tags(tree,'target')

    # Store the filename in the `f' attribute so "view source XML" for rules in
    # FF version can find it.
    tree.xpath("/ruleset")[0].attrib["f"] = os.path.basename(fi).decode(encoding="UTF-8")

    c.execute('''INSERT INTO rulesets (contents) VALUES(?)''', (etree.tostring(tree),));
    ruleset_id = c.lastrowid
    for target in targets:
        c.execute('''INSERT INTO targets (host, ruleset_id) VALUES(?, ?)''', (target, ruleset_id));

conn.commit()
conn.close()
