#!/usr/bin/env python2.7

# Uses the Python zip implementation to create deterministic XPI's
# Author: Yan Zhu, yan@mit.edu

"""
Usage: python create_xpi.py -x <exclusions> -n <name of zipped file> <directory>
"""

import argparse
import glob
import os
import sys
import zipfile_deterministic as zipfile

parser = argparse.ArgumentParser(
    description="Deterministic XPI file creator.")
parser.add_argument("-x", type=str, nargs="?",
    dest="exclusions", metavar="File with file pattern exclusions",
    default=".build_exclusions", help="Excluded file patterns.")
parser.add_argument("-n", type=str,
    dest="xpiname", help="Name of target XPI file.")
parser.add_argument("directory", type=str,
    help="Directory to compress.")

args = parser.parse_args()

compress = zipfile.ZIP_DEFLATED

xpiFile = zipfile.ZipFile(args.xpiname, mode='w', compression=compress)

f = open(args.exclusions)

os.chdir(args.directory)

exclusions = []
for line in f:
    exclusions.extend(glob.glob(line.strip()))
exclusions = map(lambda x: './'+x, exclusions)

xpiFile.write_from_directory(".", exclusions, compress_type=compress)
xpiFile.close()
