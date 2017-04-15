#!/bin/bash

set -e

if [ $# -ne 2 ]; then
  echo "Usage: $0 private_key_file output_path"
  exit
fi


RULESETS_FILE=rules/default.rulesets

SIGNED_SHA256SUM=`mktemp /tmp/ruleset-signature.sha256.XXXXXXXX`
trap 'rm $SIGNED_SHA256SUM' EXIT

mkdir -p $2
cat $RULESETS_FILE | gzip -nc | base64 -w 0 > $2/default.rulesets.gz.base64

openssl dgst -sha256 -sign $1 -out $SIGNED_SHA256SUM $2/default.rulesets.gz.base64
cat $SIGNED_SHA256SUM | base64 -w 0 > $2/rulesets-signature.sha256.base64

date +%s > $2/rulesets-timestamp
