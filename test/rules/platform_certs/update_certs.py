#! /usr/bin/env python3.6

import shutil
import os
import urllib.request
import re

shutil.rmtree("default")
os.mkdir("default")

# This cacert.pem file contains the certificate store from Mozilla
# Firefox release channel
r = urllib.request.urlopen("https://curl.haxx.se/ca/cacert.pem")
bundle = r.read().decode("utf-8")

certs = re.compile("\n{2,}").split(bundle)

# First element of certs is a comment
for cert in certs[1:]:

    filename, filecontent = re.compile("\n=+\n").split(cert)

    with open("default/{}.pem".format(filename), "w") as certfile:
            certfile.write(filecontent)

os.system("c_rehash default")
