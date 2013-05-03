#!/usr/bin/env bash

# Build an HTTPS Everywhere .crx Chromium extension (for Chromium 17+)
#
# To build the current state of the tree:
#
#     ./makecrx.sh
#
# To build a particular tagged release:
#
#     ./makecrx.sh <version number>
#
# eg:
#
#     ./makecrx.sh chrome-2012.1.26
#
# Note that .crx files must be signed; this script makes you a
# "dummy-chromium.pem" private key for you to sign your own local releases,
# but these .crx files won't detect and upgrade to official HTTPS Everywhere
# releases signed by EFF :/.  We should find a more elegant arrangement.

if [ -n "$1" ]; then
  if [ "$1" = today ] ; then
    python chromium/setversion.py
  else
    BRANCH=`git branch | head -n 1 | cut -d \  -f 2-`
    SUBDIR=checkout
    [ -d $SUBDIR ] || mkdir $SUBDIR
    cp -r -f -a .git $SUBDIR
    cd $SUBDIR
    git reset --hard "$1"
  fi
fi

VERSION=`python -c "import json ; print(json.loads(open('chromium/manifest.json').read())['version'])"`

echo "Building chrome version" $VERSION

if [ -f utils/trivial-validate.py ]; then
	VALIDATE="python utils/trivial-validate.py --ignoredups google --ignoredups facebook"
elif [ -x utils/trivial-validate ] ; then
  # This case probably never happens
	VALIDATE=./utils/trivial-validate
else
	VALIDATE=./trivial-validate
fi

if $VALIDATE src/chrome/content/rules >&2
then
  echo Validation of included rulesets completed. >&2
  echo >&2
else
  echo ERROR: Validation of rulesets failed. >&2
  exit 1
fi

if [ -f utils/relaxng.xml -a -x "$(which xmllint)" ] >&2
then
  if xmllint --noout --relaxng utils/relaxng.xml src/chrome/content/rules/*.xml
  then
    echo Validation of rulesets with RELAX NG grammar completed. >&2
  else
    echo ERROR: Validation of rulesets with RELAX NG grammar failed. >&2
    exit 1
  fi
else
  echo Validation of rulesets with RELAX NG grammar was SKIPPED. >&2
fi

sed -e "s/VERSION/$VERSION/g" chromium/updates-master.xml > chromium/updates.xml

[ -d pkg ] || mkdir -p pkg
[ -e pkg/crx ] && rm -rf pkg/crx
mkdir -p pkg/crx/rules
cd pkg/crx
cp -a ../../chromium/* .
do_not_ship="*.py *.xml icon.jpg"
rm -f $do_not_ship
cd ../..

python ./utils/merge-rulesets.py

export RULESETS=chrome/content/rules/default.rulesets
cp src/$RULESETS pkg/crx/rules/default.rulesets

echo 'var rule_list = [' > pkg/crx/rule_list.js
for i in $(find pkg/crx/rules/ -maxdepth 1 \( -name '*.xml' -o -name '*.rulesets' \))
do
    echo "\"rules/$(basename $i)\"," >> pkg/crx/rule_list.js
done
echo '];' >> pkg/crx/rule_list.js
sed -i -e "s/VERSION/$VERSION/g" pkg/crx/manifest.json
#sed -i -e "s/VERSION/$VERSION/g" pkg/crx/updates.xml
#sed -e "s/VERSION/$VERSION/g" pkg/updates-master.xml > pkg/crx/updates.xml

if [ -n "$BRANCH" ] ; then
  crx="pkg/https-everywhere-$VERSION.crx"
  key=../dummy-chromium.pem
else
  crx="pkg/https-everywhere-$VERSION~pre.crx"
  key=dummy-chromium.pem
fi
if ! [ -f "$key" ] ; then
  echo "Making a dummy signing key for local build purposes"
  openssl genrsa 2048 > "$key"
fi

## Based on https://code.google.com/chrome/extensions/crx.html

dir=pkg/crx
name=pkg/crx
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
#rm -rf pkg/crx

#python githubhelper.py $VERSION

#git add chromium/updates.xml
#git commit -m "release $VERSION"
#git tag -s chrome-$VERSION -m "release $VERSION"
#git push
#git push --tags

echo >&2 "Total included rules: `find src/chrome/content/rules -name "*.xml" | wc -l`"
echo >&2 "Rules disabled by default: `find src/chrome/content/rules -name "*.xml" | xargs grep -F default_off | wc -l`"
echo >&2 "Created $crx"
if [ -n "$BRANCH" ]; then
  cd ..
  cp $SUBDIR/$crx pkg
  rm -rf $SUBDIR
fi
