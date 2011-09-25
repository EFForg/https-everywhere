#!/bin/bash

# How to do a new release:
# 
#  1. Run: ./makecrx.sh
#  2. It'll ask you to name the new version.

echo -n "previous versions: "; curl -s "https://api.github.com/repos/aaronsw/https-everywhere/downloads" | grep name | head -n 3 | sed -e 's/    "name": "https-everywhere-//' | sed -e "s/.crx\",/   /" | tr '\n' ' '; echo

echo -n "New version: "
read VERSION


sed -e "s/VERSION/$VERSION/g" chromium/updates-master.xml > chromium/updates.xml


[ -d pkg ] || mkdir -p pkg
rm -rf pkg/crx
cp -r chromium pkg/crx
cp -r src/chrome/content/rules pkg/crx/
echo 'var rule_list = [' > pkg/crx/rule_list.js
for i in $(ls pkg/crx/rules/*.xml)
do
    echo "\"rules/$(basename $i)\"," >> pkg/crx/rule_list.js
done
echo '];' >> pkg/crx/rule_list.js
sed -ie "s/VERSION/$VERSION/g" pkg/crx/manifest.json
sed -ie "s/VERSION/$VERSION/g" pkg/crx/updates.xml

## from https://code.google.com/chrome/extensions/crx.html

dir=pkg/crx
key=chromium.pem
name=pkg/crx
crx="pkg/https-everywhere-$VERSION.crx"
pub="$name.pub"
sig="$name.sig"
zip="$name.zip"
trap 'rm -f "$pub" "$sig" "$zip"' EXIT

# zip up the crx dir
cwd=$(pwd -P)
(cd "$dir" && zip -qr -9 -X "$cwd/$zip" .)

# signature
openssl sha1 -sha1 -binary -sign "$key" < "$zip" > "$sig"

# public key
openssl rsa -pubout -outform DER < "$key" > "$pub" 2>/dev/null

byte_swap () {
  # Take "abcdefgh" and return it as "ghefcdab"
  echo "${1:6:2}${1:4:2}${1:2:2}${1:0:2}"
}

crmagic_hex="4372 3234" # Cr24
version_hex="0200 0000" # 2
pub_len_hex=$(byte_swap $(printf '%08x\n' $(ls -l "$pub" | awk '{print $5}')))
sig_len_hex=$(byte_swap $(printf '%08x\n' $(ls -l "$sig" | awk '{print $5}')))
(
  echo "$crmagic_hex $version_hex $pub_len_hex $sig_len_hex" | xxd -r -p
  cat "$pub" "$sig" "$zip"
) > "$crx"
echo "Built .crx."

python githubhelper.py $VERSION

git add chromium/updates.xml
git commit -m "release $VERSION"
git tag -s chrome-$VERSION "release $VERSION"
git push
git push --tags
