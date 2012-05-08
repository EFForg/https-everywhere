#!/usr/bin/env python

import sys, os, re, subprocess
<<<<<<< HEAD
=======
from time import sleep
>>>>>>> colonelgraff/graff

try:
    from lxml import etree
except ImportError:
    sys.stderr.write("** Could not import lxml!  Rule validation SKIPPED.\n")
    sys.stderr.write("** Caution: A resulting build MAY CONTAIN INVALID RULES.\n")
    sys.stderr.write("** Please install libxml2 and lxml to permit validation!\n")
    sys.exit(0)

base_dir = os.getcwd()
rule_script = '/'.join([base_dir, 'single_rule_response.py'])
report_file = '/'.join([base_dir, 'response_report.txt'])

if sys.argv[1:]:
    os.chdir(sys.argv[1])

failure = 0
default_off = 0
procs = []
files = os.listdir('.')
PARALLELISM = 50

with open(report_file, 'w+') as fd:
    fd.truncate(0)

while True:
    if files and len(procs) < PARALLELISM:
        fil = files.pop()
        if 'mismatches' in fil:
            continue
        try:
            tree = etree.parse(fil)

<<<<<<< HEAD
    proc = subprocess.Popen([rule_script, fil, report_file])
    procs.append(proc)

failure = 0

for proc in procs:
    failure = failure or proc.poll()
=======
            if tree.xpath('/ruleset/@default_off'):
                default_off += 1
                continue
        except Exception, e:
            continue

        proc = subprocess.Popen([rule_script, fil, report_file])
        procs.append(proc)

    for proc in procs:
        failure = failure or proc.poll()
        procs.remove(proc)

    if not (files or procs):
        break

    sleep(0.5)
>>>>>>> colonelgraff/graff

sys.stdout.write("Skipped %d default_off rulesets.\n" % default_off)

sys.exit(failure)
