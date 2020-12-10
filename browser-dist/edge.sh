#!/bin/bash
# Written for transparency and reproducibility on Edge upload
# See browser-dist.md for more info

VERSION=`python3.6 -c "import json ; print(json.loads(open('../chromium/manifest.json').read())['version'])"`
crx_cws="../pkg/https-everywhere-$VERSION-cws.crx"
crx_eff="../pkg/https-everywhere-$VERSION-eff.crx"

crx3-info rsa 0 < $crx_cws > public.pem
crx3-verify rsa 0 public.pem < $crx_cws
echo "CRX verified"

#Build Edge Zip File
echo "Building Edge Zip"
crx3-info < $crx_eff | awk '/^header/ {print $2}' \
    | xargs -I% dd if=$crx_eff iflag=skip_bytes skip=% > https-everywhere-$VERSION-edge.zip

echo >&2 "Edge zip package has sha256sum: `openssl dgst -sha256 -binary "https-everywhere-$VERSION-edge.zip" | xxd -p`"

mv https-everywhere-$VERSION-edge.zip ../pkg/https-everywhere-$VERSION-edge.zip

echo "Created pkg/https-everywhere-$VERSION-edge.zip"

#Now remove unneeded pem file
rm public.pem