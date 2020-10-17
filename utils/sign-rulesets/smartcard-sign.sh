#!/bin/bash

# For PIV-Compliant Smart Card Distributed Signing
# Tools needed:
#   YubiKey-PIV-Tool
#   YubiKey-PIV-Manager
#   OpenSC
# Change the default PIN and PUK.
# Once configured, you can now generate a public / private key pair.
# Generate the pair on slot 9c (Digital Signature).
# To generate public key file:
#   pkcs15-tool --read-public-key 02

set -e

if [ $# -ne 2 ]; then
  echo "Usage: $0 public_key_file output_path"
  exit
fi

RULESETS_FILE=rules/default.rulesets

mkdir -p $2
TIMESTAMP=`date +%s`
REFERENCE=`git rev-parse HEAD`
echo "{ \"timestamp\": $TIMESTAMP, \"reference\": \"$REFERENCE\", \"rulesets\":" "`cat $RULESETS_FILE`" "}" | tr -d '\n' | gzip -nc > $2/default.rulesets.$TIMESTAMP.gz

echo 'Hash for signing: '
sha256sum $2/default.rulesets.$TIMESTAMP.gz | cut -f1 -d' '

openssl dgst -sha256 -binary $2/default.rulesets.$TIMESTAMP.gz > default.rulesets.$TIMESTAMP.sha256

pkcs15-crypt -s -k 02 --sha-256 -i default.rulesets.$TIMESTAMP.sha256 -o $2/rulesets-signature.$TIMESTAMP.sha256 -f openssl

openssl dgst -sha256 -verify $1 -signature $2/rulesets-signature.$TIMESTAMP.sha256 $2/default.rulesets.$TIMESTAMP.gz

echo $TIMESTAMP > $2/latest-rulesets-timestamp

echo "Rulesets signed and verified"

rm default.rulesets.$TIMESTAMP.sha256
