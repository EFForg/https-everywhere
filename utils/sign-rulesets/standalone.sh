#!/bin/bash

set -e

if [ $# -ne 2 ]; then
  echo "Usage: $0 private_key_file output_path"
  exit
fi


RULESETS_FILE=rules/default.rulesets

mkdir -p $2
cat $RULESETS_FILE | gzip -nc > $2/default.rulesets.gz

openssl dgst -sha256 -sigopt rsa_padding_mode:pss -sigopt rsa_pss_saltlen:32 -sign $1 -out $2/rulesets-signature.sha256 $2/default.rulesets.gz

date +%s > $2/rulesets-timestamp
