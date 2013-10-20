#!/usr/bin/python

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
    dest="name", help="Name of Zip file.")
parser.add_argument("directory", type=str,
    help="Directory to compress.")

args = parser.parse_args()

xpiName = args.name
exclusionsFile = args.exclusions
directory = args.directory

exclusions = []
with open(exclusionsFile) as f:
    for line in f:
        exclusions.extend(glob.glob(line.strip()))
exclusions = map(lambda x: './'+x, exclusions)

compress = zipfile.ZIP_DEFLATED

xpiFile = zipfile.ZipFile(xpiName, mode='w', compression=compress)

xpiFile.write_from_directory(directory, exclusions, compress_type=compress)
xpiFile.close()
