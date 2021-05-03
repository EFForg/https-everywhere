#!/bin/bash
# Used to sign bloom filters created with https://crates.io/crates/create-bloom-filter

set -e

if [ $# -ne 3 ]; then
  echo "Usage: $0 bloom_file public_key_file output_path"
  exit
fi


SIGNED_SHA256SUM_BASE64=`mktemp /tmp/bloom-signature.sha256.base64.XXXXXXXX`
trap 'rm $SIGNED_SHA256SUM_BASE64' EXIT

mkdir -p $3
TIMESTAMP=`date +%s`
cp $1 $3/bloom.$TIMESTAMP.bin
cat $1.json | $(dirname $0)/add_timestamp.py $TIMESTAMP > $3/bloom-metadata.$TIMESTAMP.json

echo 'Hash for signing: '
sha256sum $3/bloom-metadata.$TIMESTAMP.json | cut -f1 -d' '
echo metahash for confirmation only $(sha256sum $3/bloom-metadata.$TIMESTAMP.json | cut -f1 -d' ' | tr -d '\n' | sha256sum | cut -c1-6) ...

echo 'Paste in the data from the QR code, then type Ctrl-D:'
cat | tr -d '\n' > $SIGNED_SHA256SUM_BASE64

base64 -d $SIGNED_SHA256SUM_BASE64 > $3/bloom-signature.$TIMESTAMP.sha256
openssl dgst -sha256 -sigopt rsa_padding_mode:pss -sigopt rsa_pss_saltlen:32 -verify $2 -signature $3/bloom-signature.$TIMESTAMP.sha256 $3/bloom-metadata.$TIMESTAMP.json

echo $TIMESTAMP > $3/latest-bloom-timestamp
