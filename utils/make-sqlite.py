#!/usr/bin/python2.7
#
# Builds an sqlite DB containing all the rulesets, indexed by target.

import sqlite3
import argparse
import sys, re, os

from lxml import etree

parser = argparse.ArgumentParser(
    formatter_class=argparse.RawDescriptionHelpFormatter,
    description="Ruleset validation script.")
parser.add_argument('ruleset', metavar='XML directory', type=str, nargs="*",
    default="src/chrome/content/rules",
    help='Directory of XML files to validate.')

args = parser.parse_args()

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
              name TEXT,
              contents TEXT)''')
c.execute('''DROP TABLE IF EXISTS targets''')
c.execute('''CREATE TABLE targets
             (host TEXT,
              ruleset_id INTEGER)''')

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
    # TODO: Strip target tags too. Right now the JS code requires there be a
    # target tag.
    #etree.strip_tags(tree,'target')

    # TODO: filter out comments and targets to save storage bytes
    ruleset_name = tree.xpath("/ruleset/@name")[0]
    c.execute('''INSERT INTO rulesets (name, contents) VALUES(?, ?)''', (ruleset_name, etree.tostring(tree)));
    ruleset_id = c.lastrowid
    for target in targets:
        c.execute('''INSERT INTO targets (host, ruleset_id) VALUES(?, ?)''', (target, ruleset_id));

conn.commit()
conn.close()
