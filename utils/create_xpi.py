import os
import zipfile
import sys
import time
import glob

xpiName = sys.argv[1]
exclusionsFile = sys.argv[2]
exclusions = []

with open(exclusionsFile) as f:
    for line in f:
        exclusions.extend(glob.glob(line.strip()))

xpiFile = zipfile.ZipFile(xpiName, mode='w')

def constructZipInfo(filename):
    """Create deterministic ZIP metadata for a given file"""
    info = zipfile.ZipInfo(filename, time.gmtime(1378343307))
    info.compress_type = 0
    info.comment = ''
    info.extra = ''
    info.create_system = 3
    info.create_version = 20
    info.extract_version = 20
    if os.path.isfile(filename):
        info.external_attr = 0664 << 16L
    elif os.path.isdir(filename):
        info.external_attr = 04775 << 16L
    # info.external_attr = 2176057344L
    info.volume = 0
    return info

for root,subfolders,files in os.walk('.'):
    for fi in files:
        filename = os.path.join(root,fi)
        if filename not in map(lambda x: './'+x, exclusions):
            print("Adding to zip: "+filename)
            info = constructZipInfo(filename)
            xpiFile.writestr(info, open(filename).read())

xpiFile.close()
