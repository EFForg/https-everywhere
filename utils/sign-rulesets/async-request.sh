#!/bin/bash

set -e

if [ $# -ne 2 ]; then
  echo "Usage: $0 public_key_file output_path"
  exit
fi


RULESETS_FILE=rules/default.rulesets

SIGNED_SHA256SUM_BASE64=`mktemp /tmp/ruleset-signature.sha256.base64.XXXXXXXX`
trap 'rm $SIGNED_SHA256SUM_BASE64' EXIT

mkdir -p $2
cat $RULESETS_FILE | gzip -nc > $2/default.rulesets.gz

echo 'Hash for signing: '
sha256sum $2/default.rulesets.gz | cut -f1 -d' '
echo metahash for confirmation only $(sha256sum $2/default.rulesets.gz | cut -f1 -d' ' | tr -d '\n' | sha256sum | cut -c1-6) ...

echo 'Paste in the data from the QR code, then type Ctrl-D:'
cat | tr -d '\n' > $SIGNED_SHA256SUM_BASE64

base64 -d $SIGNED_SHA256SUM_BASE64 > $2/rulesets-signature.sha256
openssl dgst -sha256 -sigopt rsa_padding_mode:pss -sigopt rsa_pss_saltlen:32 -verify $1 -signature $2/rulesets-signature.sha256 $2/default.rulesets.gz

date +%s > $2/rulesets-timestamp
