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

for root,subfolders,files in os.walk('.'):
    for fi in files:
        filename = os.path.join(root,fi)
        if filename not in exclusions:
          info = zipfile.ZipInfo(filename, time.gmtime(1378343307))
          xpiFile.writestr(info, '')

xpiFile.close()
