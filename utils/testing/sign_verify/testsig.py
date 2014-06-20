"""This little test module attempts to verify the signature over the raw content of
update.json.

This script makes use of the PyCrypto library to verify signatures.

Instructions for generating keys for signing and for taking the signature can be
found at https://gist.github.com/redwire/2e1d8377ea58e43edb40
"""

import os
import base64
from Crypto.PublicKey import RSA
from Crypto.Signature import PKCS1_v1_5 as pkcs
from Crypto.Hash import SHA

print('WARNING: None of the data in this directory should be deployed ' +
      'or used for signing in the extension itself!')

pubkey = ''.join([
    'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwNFv2HXZ5YdXa18irhRR',
    'rzGGQERbzEKGhE/5NHY5go75dpt0eIe3AMhRNkeDaF3fiV6yABAjre6EZlxRvzzx',
    'W9iSdSqkbHk7nvqQMnWLQCKW0e5VlVCGdIZ71kJREEFjaeuyWIQef7gEsoFRd0Xd',
    '6L1LLCAamJ2cf+Qx4ARGyUwsfQGWpmt/qTV1Ts7t3VDD7kOMBkI6rRzEvNblgpJ3',
    '9BDbQap6Dua1kFxdrY77Pkarh+ziaOQ3TWbO3qFOy9RpKZ4TusJp1qlOymmiclpC',
    'tMeTAbZr4aYzUJ/fqe4RPWReWji4fwdsHR6zXWCTbTunCUMluMe7zyCa84TzZv/o',
    'ywIDAQAB'
])

sig = ''.join([
    'Rhp1a6wiOxEOqpcx/pjED+lxm8EaXzHukzdXZhZ01UVPMihl0HcYg+tF3WFWZ90p',
    'PYQ9uuWo1/pfOp/TJXhcbCJnr+0oDQWtV3UVFWeimm+He9Dl4ck+hTltxz0Y6i3J',
    'oz30SBuKFFR5L9tsKAeXG93etUL55UcfW0ENVwam6nfzjfV0JHQkoQ8cbIrO8yeh',
    'NxOk1H+ohJewCyVJUZODVPQ9bC0NZC/jJ7gB/kY5jjNBiOJsTN4RVhk3p8+V94DZ',
    'ChqRrJTmo5JLGyfmReCb01PTRqJafDHlwrBBFIjHBpNJgTNRk065Zc6N2OCfmIaT',
    'SHnsd+mPHI483CJkyLWojw=='
])

json_path = os.curdir + os.sep + 'update.json'

keyPEM = base64.standard_b64decode(pubkey)
keyPub = RSA.importKey(keyPEM)

try:
  content = open(json_path, "rb").read()
except IOError:
  print('Could not read content from ' + json_path)
  print('This program expects an update.json file to exist in the same directory.')
  sys.exit(1)

verifier = pkcs.new(keyPub)
h = SHA.new(content)
result = verifier.verify(h, sig)

print('Result of signature verification: ' + str(result))

