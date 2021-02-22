#!/usr/bin/env python3.6

# Uses the Python zip implementation to create deterministic zip's
# Author: Yan Zhu, yan@mit.edu

"""
Usage: python3.6 create_zip.py -x <exclusions> -n <name of zipped file> <directory>
"""

import argparse
import glob
import os
import zipfile_deterministic as zipfile

parser = argparse.ArgumentParser(
    description="Deterministic zip file creator.")
parser.add_argument("-x", type=str, nargs="?",
    dest="exclusions", metavar="File with file pattern exclusions",
    default=".build_exclusions", help="Excluded file patterns.")
parser.add_argument("-n", type=str,
    dest="zipname", help="Name of target zip file.")
parser.add_argument("directory", type=str,
    help="Directory to compress.")

args = parser.parse_args()

compress = zipfile.ZIP_DEFLATED

createdZipFile = zipfile.ZipFile(args.zipname, mode='w', compression=compress)

f = open(args.exclusions)

os.chdir(args.directory)

exclusions = []
for line in f:
    exclusions.extend(glob.glob(line.strip()))
exclusions = list(map(lambda x: './'+x, exclusions))

createdZipFile.write_from_directory(".", exclusions, compress_type=compress)
createdZipFile.close()
