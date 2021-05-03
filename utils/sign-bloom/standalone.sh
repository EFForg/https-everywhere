#!/bin/bash
# Used to sign bloom filters created with https://crates.io/crates/create-bloom-filter

set -e

if [ $# -ne 3 ]; then
  echo "Usage: $0 bloom_file private_key_file output_path"
  exit
fi


mkdir -p $3
TIMESTAMP=`date +%s`
cp $1 $3/bloom.$TIMESTAMP.bin
cat $1.json | $(dirname $0)/add_timestamp.py $TIMESTAMP > $3/bloom-metadata.$TIMESTAMP.json

openssl dgst -sha256 -sigopt rsa_padding_mode:pss -sigopt rsa_pss_saltlen:32 -sign $2 -out $3/bloom-signature.$TIMESTAMP.sha256 $3/bloom-metadata.$TIMESTAMP.json

echo $TIMESTAMP > $3/latest-bloom-timestamp
