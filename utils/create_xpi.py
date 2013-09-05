#!/usr/bin/env python

import os
import zipfile
import sys
import time
import glob
import zlib

xpiName = sys.argv[1]
exclusionsFile = sys.argv[2]
exclusions = []
tmpfile = '../pkg/tmp.xpi'

with open(exclusionsFile) as f:
    for line in f:
        exclusions.extend(glob.glob(line.strip()))

xpiFile = zipfile.ZipFile(xpiName, mode='w')

def createTmpZipInfo():
    """
    Create a non-deterministic zip in order to use the file info
    generated to create a deterministic zip
    """
    xpiFileTmp = zipfile.ZipFile(tmpfile, mode='w')
    for root,subfolders,files in os.walk('.'):
        for fi in files:
            filename = os.path.join(root,fi)
            if filename not in map(lambda x: './'+x, exclusions):
                xpiFileTmp.write(filename, compress_type=zipfile.ZIP_DEFLATED)
    xpiFileTmp.close()
    return xpiFileTmp.infolist()

def constructZipDet():
    """
    Create a deterministic zip by setting timestamps and
    system/version info to hard-coded values.
    """
    tmpInfo = createTmpZipInfo()
    for info in tmpInfo:
        info.date_time = time.gmtime(1378343307)
        info.create_system = 3
        info.create_version = 20
        info.extract_version = 20
        print("adding to zip: "+info.filename)
        xpiFile.writestr(info, open(info.filename).read())

constructZipDet()
xpiFile.close()
os.remove(tmpfile)
