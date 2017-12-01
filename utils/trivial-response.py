#!/usr/bin/env python2.7

import sys
import os
import subprocess
from time import sleep

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
rule_file = '/'.join([base_dir, '%s_report.txt'])

if sys.argv[1:]:
    os.chdir(sys.argv[1])

failure = 0
default_off = 0
procs = []
files = os.listdir('.')
PARALLELISM = 10

with open(report_file, 'w+') as fd:
    fd.truncate(0)

while True:
    if files and (len(procs) < PARALLELISM):
        fil = files.pop()
        if 'mismatches' in fil:
            continue
        try:
            tree = etree.parse(fil)

            if tree.xpath('/ruleset/@default_off'):
                default_off += 1
                continue
        except Exception as e:
            continue

        proc = subprocess.Popen([rule_script, fil, rule_file %
            fil[:-4]])
        procs.append((proc, fil[:-4]))

    for (proc, f) in procs:
        proc.poll()
        print("POLL'D")
        if proc.returncode != None:
            print("FUCKED")
            with open(rule_file % f, 'r') as rule_fd:
                with open(report_file, 'a') as report_fd:
                    print("CONTEXT")
                    report_fd.writelines(rule_fd)
            os.unlink(rule_file % f)
            procs.remove((proc, f))

    if not (files or procs):
        break

    sleep(0.75)

sys.stdout.write("Skipped %d default_off rulesets.\n" % default_off)

sys.exit(failure)
