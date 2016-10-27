#!/usr/bin/env python

# Given a directory as arg1 with PEM certs as *.pem named files, return list of
# filenames that constitute set of unique certs (comparison is done on certs'
# SHA256)
#
# Symlinks are skipped, only regular files are returned.
#
# Second directory can be specified as arg2, containing *.pem certificates that
# should be skipped - i.e. set subtraction. Symlinks are accounted for in this
# exclude dir).

import os
import sys
import logging
import ssl
from hashlib import sha256
from glob import glob

def pemFileHash(fname):
    """ Return SHA256 hash of PEM cert in hex """
    with file(fname) as certFile:
        pemData = certFile.read()
        derData = ssl.PEM_cert_to_DER_cert(pemData)
        certDigest = sha256(derData).hexdigest()

        return certDigest


sourceDir = sys.argv[1]
if not os.path.isdir(sourceDir):
    raise ValueError("%s is not a directory" % sourceDir)

filenames = glob("%s/*.pem" % sourceDir)
filenames.sort() #let's have some deterministic ordering
hash2cert = {}

# Certs to be excluded
if len(sys.argv) >= 3:
    excludeDir = sys.argv[2]
    if not os.path.isdir(excludeDir):
        raise ValueError("%s is not a directory" % excludeDir)

    for fname in filter(os.path.isfile, glob(excludeDir+"/*.pem")):
        try:
            certDigest = pemFileHash(fname)
            hash2cert[certDigest] = fname
        except:
            logging.exception("Failed to process certificate file %s" % fname)

# take only regular files, no symlinks
filenames = [f for f in filenames if os.path.isfile(f) and not os.path.islink(f)]

for fname in filenames:
    try:
        certDigest = pemFileHash(fname)
        if certDigest not in hash2cert:
            print fname
            hash2cert[certDigest] = fname
    except:
    	logging.exception("Failed to process certificate file %s" % fname)

