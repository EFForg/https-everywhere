#!/bin/bash

# For PIV-Compliant Smart Card Distributed Signing
    # AppImage for Yubikey Manager
    # `sudo apt install opensc`
    # `sudo apt-get install ykcs11`
# Change the default PIN and PUK.
# Once configured, you can now generate a public / private key pair.
# Generate the pair on slot 9c (Digital Signature) and export pem file
# To generate public key file:
#   openssl x509 -in cert.pem -pubkey -noout > pubkey.pem
#  ./utils/sign-rulesets/smartcard.sh pubkey.pem ~/[...]/https-rulesets/app/files/v1

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

openssl dgst -sha256 -binary $2/default.rulesets.$TIMESTAMP.gz > $2/default.rulesets.$TIMESTAMP.sha256

pkcs11-tool --module /usr/lib/x86_64-linux-gnu/libykcs11.so --sign --id 2 -m RSA-PKCS-PSS --mgf MGF1-SHA256 --hash-algorithm SHA256 --salt-len 32 -i $2/default.rulesets.$TIMESTAMP.sha256 -o $2/rulesets-signature.$TIMESTAMP.sha256

openssl dgst -sha256 -sigopt rsa_padding_mode:pss -sigopt rsa_pss_saltlen:32 -verify pubkey.pem -signature $2/rulesets-signature.$TIMESTAMP.sha256 $2/default.rulesets.$TIMESTAMP.gz

echo $TIMESTAMP > $2/latest-rulesets-timestamp

echo "Rulesets signed and verified"

rm $2/default.rulesets.$TIMESTAMP.sha256