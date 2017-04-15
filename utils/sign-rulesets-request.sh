#!/bin/bash

set -e

if [ $# -ne 2 ]; then
  echo "Usage: $0 public_key_file output_path"
  exit
fi


RULESETS_FILE=rules/default.rulesets

SIGNED_SHA256SUM=`mktemp /tmp/ruleset-signature.sha256.XXXXXXXX`
trap 'rm $SIGNED_SHA256SUM' EXIT

mkdir -p $2
cat $RULESETS_FILE | gzip -nc | base64 -w 0 > $2/default.rulesets.gz.base64

echo 'Hash for signing: '
sha256sum $2/default.rulesets.gz.base64 | cut -f1 -d' '
echo metahash for confirmation only $(sha256sum $2/default.rulesets.gz.base64 | cut -f1 -d' ' | tr -d '\n' | sha256sum | cut -c1-6) ...

echo 'Paste in the data from the QR code, then type Ctrl-D:'
cat | tr -d '\n' > $2/rulesets-signature.sha256.base64

base64 -d $2/rulesets-signature.sha256.base64 > $SIGNED_SHA256SUM
openssl dgst -sha256 -verify $1 -signature $SIGNED_SHA256SUM $2/default.rulesets.gz.base64

date +%s > $2/rulesets-timestamp
