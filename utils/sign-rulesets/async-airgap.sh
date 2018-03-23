#!/bin/bash

set -e

if [ $# -ne 2 ]; then
  echo "Usage: $0 private_key_file sha256_hash"
  exit
fi


echo metahash for confirmation only $(echo -n $2 | sha256sum | cut -c1-6) ...
read -p "(press enter to continue)"

SIGNED_SHA256SUM=`mktemp /tmp/ruleset-signature.sha256.XXXXXXXX`
trap 'rm $SIGNED_SHA256SUM' EXIT
SIGNED_SHA256SUM_BASE64_QR=`mktemp /tmp/ruleset-signature.sha256.base64.XXXXXXXX.png`
trap 'rm $SIGNED_SHA256SUM_BASE64_QR' EXIT

echo $2 | xxd -r -p | openssl pkeyutl -sign -inkey $1 -pkeyopt digest:sha256 -pkeyopt rsa_padding_mode:pss -pkeyopt rsa_pss_saltlen:32 -out $SIGNED_SHA256SUM

cat $SIGNED_SHA256SUM | base64
cat $SIGNED_SHA256SUM | base64 | qrencode -o $SIGNED_SHA256SUM_BASE64_QR
eog $SIGNED_SHA256SUM_BASE64_QR 2>/dev/null
