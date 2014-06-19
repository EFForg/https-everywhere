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

print('WARNING: None of the data in this directory should be deployed or used for signing!')

pubkey = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAwNFv2HXZ5YdXa18irhRRrzGGQERbzEKGhE/5NHY5go75dpt0eIe3AMhRNkeDaF3fiV6yABAjre6EZlxRvzzxW9iSdSqkbHk7nvqQMnWLQCKW0e5VlVCGdIZ71kJREEFjaeuyWIQef7gEsoFRd0Xd6L1LLCAamJ2cf+Qx4ARGyUwsfQGWpmt/qTV1Ts7t3VDD7kOMBkI6rRzEvNblgpJ39BDbQap6Dua1kFxdrY77Pkarh+ziaOQ3TWbO3qFOy9RpKZ4TusJp1qlOymmiclpCtMeTAbZr4aYzUJ/fqe4RPWReWji4fwdsHR6zXWCTbTunCUMluMe7zyCa84TzZv/oywIDAQAB"

sig = "A8d0Jg82SM5OIehJ+HA+sFFABWWbLMDkDVtRhgKYEa5r/R8zrduNb3mp/DBlQcC8HLWKBcT3XPQyxuBmh34en9y/v5YhPUs0ecyk2+ORB+4rMU6pQK/jcyMubumwpILZ52EF2vWxQ/aY44/6UgjEm+ZHZ5afSaB1vmXMxa3q/1+R3cqWmaZGlbYWk3BA/JKbhfmPTO3/PwArFwtBVMRdrHszj8TAuRntujpdjT8gkasLVwI6NZKMgk7t5sGtBSCoOo4hEhOe2Z5y22K7BynXNmLI67nsBs0eyRO5ZqkNtGkPQ70TFgemNuRd0qz/+/LGU+jhkgy2qwENqp/7OP9rkg=="

json_path = os.curdir + os.sep + 'update.json'

keyPEM = base64.standard_b64decode(pubkey)
keyPub = RSA.importKey(keyPEM)

try:
  content = open(json_path).read()
except IOError:
  print('Could not read content from ' + json_path)
  print('This program expects an update.json file to exist in the same directory.')
  sys.exit(1)

verifier = pkcs.new(keyPub)
h = SHA.new(content)
result = verifier.verify(h, sig)

print('Result of signature verification: ' + str(result))

