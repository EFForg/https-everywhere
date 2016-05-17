#!/usr/bin/env bash

set -e

ADDON_ID=https-everywhere@cliqz.com
CHANNEL=$1
PATH=/openssl-0.9.8zg/apps/:$PATH
SECURE_PATH=./secure/$ADDON_ID

if [ $# -eq 0 ];
then
  echo "CHANNEL_NAME is required"
  echo "  example: ./build_sign_and_publish.sh browser_beta"
  exit 1
fi

echo "CLIQZ: clobber"
rm -rf pkg

echo "CLIQZ: build"
./makexpi.sh

XPI_NAME=`ls pkg/*-cliqz.xpi | head -1 | xargs basename`
VERSION=`echo $XPI_NAME | grep -E -o '[0-9]+\.[0-9]+\.[0-9]+'`
SIGNED_XPI_NAME=$ADDON_ID-$VERSION-$CHANNEL-signed.xpi
S3_UPLOAD_URL=s3://cdncliqz/update/browser_beta/https-everywhere/$SIGNED_XPI_NAME
DOWNLOAD_URL=https://s3.amazonaws.com/cdncliqz/update/browser_beta/https-everywhere/$SIGNED_XPI_NAME

echo "CLIQZ: sign"
python ./xpi-sign/xpisign.py \
  --signer openssl \
  --keyfile $SECURE_PATH/certs \
  --passin file:$SECURE_PATH/pass \
  pkg/$XPI_NAME \
  pkg/$SIGNED_XPI_NAME

echo "CLIQZ: upload"
source $SECURE_PATH/upload-creds.sh
aws s3 cp pkg/$SIGNED_XPI_NAME $S3_UPLOAD_URL --acl public-read
echo "XPI uploaded to: ${S3_UPLOAD_URL}"

echo "CLIQZ: publish"
python ./cliqz/submitter.py \
  --credentials-file $SECURE_PATH/balrog-creds.txt \
  --username balrogadmin \
  --api-root http://balrog-admin.10e99.net/api \
  --release-channel $CHANNEL \
  --addon-id $ADDON_ID \
  --addon-version $VERSION \
  --addon-url $DOWNLOAD_URL
