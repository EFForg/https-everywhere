#!/usr/bin/env bash

# Build an HTTPS Everywhere .crx & .xpi extension
#
# To build the current state of the tree:
#
#     ./make.sh
#
# To build a particular tagged release:
#
#     ./make.sh <version number>
#
# eg:
#
#     ./make.sh 2017.8.15
#
# Note that .crx files must be signed; this script makes you a
# "dummy-chromium.pem" private key for you to sign your own local releases,
# but these .crx files won't detect and upgrade to official HTTPS Everywhere
# releases signed by EFF :/.  We should find a more elegant arrangement.

cd $(dirname $0)

if [ -n "$1" -a "$1" != "--remove-extension-update" -a "$1" != "--remove-update-channels" ]; then
  BRANCH=`git branch | head -n 1 | cut -d \  -f 2-`
  SUBDIR=checkout
  [ -d $SUBDIR ] || mkdir $SUBDIR
  cp -r -f -a .git $SUBDIR
  cd $SUBDIR
  git reset --hard "$1"
  git submodule update --recursive -f
fi

VERSION=`python3.6 -c "import json ; print(json.loads(open('chromium/manifest.json').read())['version'])"`

echo "Building version" $VERSION

[ -d pkg ] || mkdir -p pkg
[ -e pkg/crx ] && rm -rf pkg/crx
[ -e pkg/xpi-amo ] && rm -rf pkg/xpi-amo
[ -e pkg/xpi-eff ] && rm -rf pkg/xpi-eff

# Clean up obsolete ruleset databases, just in case they still exist.
rm -f src/chrome/content/rules/default.rulesets src/defaults/rulesets.sqlite

sed -e "s/VERSION/$VERSION/g" chromium/updates-master.xml > chromium/updates.xml

mkdir -p pkg/crx/rules
cd pkg/crx
cp -a ../../chromium/* ./
# Turn the Firefox translations into the appropriate Chrome format:
rm -rf _locales/
mkdir _locales/
python3.6 ../../utils/chromium-translations.py ../../translations/ _locales/
python3.6 ../../utils/chromium-translations.py ../../src/chrome/locale/ _locales/
do_not_ship="*.py *.xml"
rm -f $do_not_ship
cd ../..

python3.6 ./utils/merge-rulesets.py || exit 1

cp src/chrome/content/rules/default.rulesets pkg/crx/rules/default.rulesets

sed -i -e "s/VERSION/$VERSION/g" pkg/crx/manifest.json

cp -a pkg/crx pkg/xpi-amo
cp -a pkg/crx pkg/xpi-eff
cp -a src/META-INF pkg/xpi-amo
cp -a src/META-INF pkg/xpi-eff

# Remove the 'applications' manifest key from the crx version of the extension, change the 'author' string to a hash, and add the "update_url" manifest key
# "update_url" needs to be present to avoid problems reported in https://bugs.chromium.org/p/chromium/issues/detail?id=805755
python3.6 -c "import json; m=json.loads(open('pkg/crx/manifest.json').read()); m['author']={'email': 'eff.software.projects@gmail.com'}; del m['applications']; m['update_url'] = 'https://clients2.google.com/service/update2/crx'; open('pkg/crx/manifest.json','w').write(json.dumps(m,indent=4,sort_keys=True))"
# Remove the 'update_url' manifest key from the xpi version of the extension delivered to AMO
python3.6 -c "import json; m=json.loads(open('pkg/xpi-amo/manifest.json').read()); del m['applications']['gecko']['update_url']; m['applications']['gecko']['id'] = 'https-everywhere@eff.org'; open('pkg/xpi-amo/manifest.json','w').write(json.dumps(m,indent=4,sort_keys=True))"

# If the --remove-extension-update flag is set, ensure the extension is unable to update
if [ "$1" == "--remove-extension-update" -o "$2" == "--remove-extension-update" -o "$3" == "--remove-extension-update" ]; then
  echo "Flag --remove-extension-update specified.  Removing the XPI extensions' ability to update."
  python3.6 -c "import json; m=json.loads(open('pkg/xpi-amo/manifest.json').read()); m['applications']['gecko']['update_url'] = 'data:text/plain,'; open('pkg/xpi-amo/manifest.json','w').write(json.dumps(m,indent=4,sort_keys=True))"
  python3.6 -c "import json; m=json.loads(open('pkg/xpi-eff/manifest.json').read()); m['applications']['gecko']['update_url'] = 'data:text/plain,'; open('pkg/xpi-eff/manifest.json','w').write(json.dumps(m,indent=4,sort_keys=True))"
fi

# If the --remove-update-channels flag is set, remove all out-of-band update channels
if [ "$1" == "--remove-update-channels" -o "$2" == "--remove-update-channels" -o "$3" == "--remove-update-channels" ]; then
  echo "Flag --remove-update-channels specified.  Removing all out-of-band update channels."
  echo "require.scopes.update_channels.update_channels = [];" >> pkg/crx/background-scripts/update_channels.js
  echo "require.scopes.update_channels.update_channels = [];" >> pkg/xpi-amo/background-scripts/update_channels.js
  echo "require.scopes.update_channels.update_channels = [];" >> pkg/xpi-eff/background-scripts/update_channels.js
fi

if [ -n "$BRANCH" ] ; then
  crx="pkg/https-everywhere-$VERSION.crx"
  xpi_amo="pkg/https-everywhere-$VERSION-amo.xpi"
  xpi_eff="pkg/https-everywhere-$VERSION-eff.xpi"
  key=../dummy-chromium.pem
else
  crx="pkg/https-everywhere-$VERSION~pre.crx"
  xpi_amo="pkg/https-everywhere-$VERSION~pre-amo.xpi"
  xpi_eff="pkg/https-everywhere-$VERSION~pre-eff.xpi"
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
(cd "$dir" && ../../utils/create_zip.py -n "$cwd/$zip" -x "../../.build_exclusions" .)
echo >&2 "CWS crx package has sha256sum: `openssl dgst -sha256 -binary "$cwd/$zip" | xxd -p`"

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

# Case-insensitive matching is a GNU extension unavailable when using BSD sed.
if [[ "$(sed --version 2>&1)" =~ "GNU" ]]; then
  sed="sed"
elif [[ "$(gsed --version 2>&1)" =~ "GNU" ]]; then
  sed="gsed"
fi

(
  echo "$crmagic_hex $version_hex $pub_len_hex $sig_len_hex" | $sed -e 's/\s//g' -e 's/\([0-9A-F]\{2\}\)/\\\\\\x\1/gI' | xargs printf
  cat "$pub" "$sig" "$zip"
) > "$crx"



# now zip up the xpi AMO dir
name=pkg/xpi-amo
dir=pkg/xpi-amo
zip="$name.zip"

cwd=$(pwd -P)
(cd "$dir" && ../../utils/create_zip.py -n "$cwd/$zip" -x "../../.build_exclusions" .)
echo >&2 "AMO xpi package has sha256sum: `openssl dgst -sha256 -binary "$cwd/$zip" | xxd -p`"

cp $zip $xpi_amo



# now zip up the xpi EFF dir
name=pkg/xpi-eff
dir=pkg/xpi-eff
zip="$name.zip"

cwd=$(pwd -P)
(cd "$dir" && ../../utils/create_zip.py -n "$cwd/$zip" -x "../../.build_exclusions" .)
echo >&2 "EFF xpi package has sha256sum: `openssl dgst -sha256 -binary "$cwd/$zip" | xxd -p`"

cp $zip $xpi_eff



bash utils/android-push.sh "$xpi_eff"

echo >&2 "Total included rules: `find src/chrome/content/rules -name "*.xml" | wc -l`"
echo >&2 "Rules disabled by default: `find src/chrome/content/rules -name "*.xml" | xargs grep -F default_off | wc -l`"

# send the following to stdout so scripts can parse it
# see test/selenium/shim.py
echo "Created $xpi_amo"
echo "Created $xpi_eff"
echo "Created $crx"

if [ -n "$BRANCH" ]; then
  cd ..
  cp $SUBDIR/$crx pkg
  cp $SUBDIR/$xpi_amo pkg
  cp $SUBDIR/$xpi_eff pkg
  rm -rf $SUBDIR
fi
