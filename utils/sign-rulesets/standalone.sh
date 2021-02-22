#!/bin/bash

set -e

if [ $# -ne 2 ]; then
  echo "Usage: $0 private_key_file output_path"
  exit
fi


RULESETS_FILE=rules/default.rulesets

mkdir -p $2
TIMESTAMP=`date +%s`
REFERENCE=`git rev-parse HEAD`
echo "{ \"timestamp\": $TIMESTAMP, \"reference\": \"$REFERENCE\", \"rulesets\":" "`cat $RULESETS_FILE`" "}" | tr -d '\n' | gzip -nc > $2/default.rulesets.$TIMESTAMP.gz

openssl dgst -sha256 -sigopt rsa_padding_mode:pss -sigopt rsa_pss_saltlen:32 -sign $1 -out $2/rulesets-signature.$TIMESTAMP.sha256 $2/default.rulesets.$TIMESTAMP.gz

echo $TIMESTAMP > $2/latest-rulesets-timestamp
