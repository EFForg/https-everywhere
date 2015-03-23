#!/usr/bin/python2.7

# Uses the Python zip implementation to create deterministic XPI's
# Author: Yan Zhu, yan@mit.edu

"""
Usage: python create_xpi.py -x <exclusions> -n <name of zipped file> <directory>
"""

import argparse
import zipfile_deterministic as zipfile
import sys
import glob

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

exclusions = []
with open(args.exclusions) as f:
    for line in f:
        exclusions.extend(glob.glob(line.strip()))
exclusions = map(lambda x: './'+x, exclusions)

compress = zipfile.ZIP_DEFLATED

xpiFile = zipfile.ZipFile(args.xpiname, mode='w', compression=compress)

xpiFile.write_from_directory(args.directory, exclusions, compress_type=compress)
xpiFile.close()
