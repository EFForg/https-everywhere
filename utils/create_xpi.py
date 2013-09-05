import os
import zipfile
import sys
import time

xpiName = sys.argv[1]
xpiFile = zipfile.ZipFile(xpiName, mode='w')


for root,subfolders,files in os.walk('.'):
    for fi in files:
        f = os.path.join(root,fi)
        info = zipfile.ZipInfo(f, time.gmtime(1378343307))
        xpiFile.writestr(info, '')

xpiFile.close()
