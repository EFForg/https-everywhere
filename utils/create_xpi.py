#!/usr/bin/env python

# Uses the Python zip implementation to create deterministic XPI's
# Author: Yan Zhu, yan@mit.edu

# ZipFile: infolist, write, writestr,

import zipfile_deterministic as zipfile
import sys
import glob

xpiName = sys.argv[1]
exclusionsFile = sys.argv[2]
exclusions = []
compress = zipfile.ZIP_DEFLATED

with open(exclusionsFile) as f:
    for line in f:
        exclusions.extend(glob.glob(line.strip()))
exclusions = map(lambda x: './'+x, exclusions)

xpiFile = zipfile.ZipFile(xpiName, mode='w', compression=compress)

xpiFile.write_from_directory('.', exclusions, compress_type=compress)
xpiFile.close()
