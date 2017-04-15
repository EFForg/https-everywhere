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
ASN1_CONFIG=`mktemp /tmp/asn1.conf.XXXXXXXX`
trap 'rm $ASN1_CONFIG' EXIT
ASN1_DGST=`mktemp /tmp/asn1.dgst.XXXXXXXX`
trap 'rm $ASN1_DGST' EXIT
SIGNED_SHA256SUM_BASE64_QR=`mktemp /tmp/ruleset-signature.sha256.base64.XXXXXXXX.png`
trap 'rm $SIGNED_SHA256SUM_BASE64_QR' EXIT

cat >$ASN1_CONFIG <<EOF
asn1 = SEQUENCE:digest_info_and_digest

[digest_info_and_digest]
dinfo = SEQUENCE:digest_info
digest = FORMAT:HEX,OCT:$2

[digest_info]
algid = OID:2.16.840.1.101.3.4.2.1
params = NULL

EOF

openssl asn1parse -i -genconf $ASN1_CONFIG -out $ASN1_DGST > /dev/null

openssl rsautl -sign -in $ASN1_DGST -inkey $1 -out $SIGNED_SHA256SUM

cat $SIGNED_SHA256SUM | base64 | qrencode -o $SIGNED_SHA256SUM_BASE64_QR
eog $SIGNED_SHA256SUM_BASE64_QR 2>/dev/null
