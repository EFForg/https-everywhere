#!/usr/bin/env python

# Uses the Python zip implementation to create deterministic XPI's
# Author: Yan Zhu, yan@mit.edu

"""
Usage: python create_xpi.py -x <exclusions> -n <name of zipped file> <directory>
"""

import zipfile_deterministic as zipfile
import sys
import glob
import getopt

opts, args = getopt.getopt(sys.argv[1:], 'x:n:')

exclusions = []
for o, v in opts:
    if o == "-x":
        exclusionsFile = v
        with open(exclusionsFile) as f:
            for line in f:
                exclusions.extend(glob.glob(line.strip()))
        exclusions = map(lambda x: './'+x, exclusions)
    elif o == "-n":
        xpiName = v

compress = zipfile.ZIP_DEFLATED

xpiFile = zipfile.ZipFile(xpiName, mode='w', compression=compress)

directory = args[0]

xpiFile.write_from_directory(directory, exclusions, compress_type=compress)
xpiFile.close()
