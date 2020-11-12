#!/usr/bin/env bash

# Build an HTTPS Everywhere Opera CRX Distribution
# Written for transparency and reproducibility on Opera upload
# See browser-dist.md for more info

# To build the current state of the tree:
#
#     ./browser-dist-opera.sh
#
# To build a particular tagged release:
#
#     ./browser-dist-opera.sh <version number>
#
# eg:
#
#     ./browser-dist-opera.sh 2017.8.15
#
# Note that .crx files must be signed; this script makes you a
# "dummy-chromium.pem" private key for you to sign your own local releases,
# but these .crx files won't detect and upgrade to official HTTPS Everywhere
# releases signed by EFF :/.  We should find a more elegant arrangement.

! getopt --test > /dev/null
if [[ ${PIPESTATUS[0]} -ne 4 ]]; then
  echo 'I’m sorry, `getopt --test` failed in this environment.'
  exit 1
fi

OPTIONS=eck:
LONGOPTS=remove-extension-update,remove-update-channels,key:
! PARSED=$(getopt --options=$OPTIONS --longoptions=$LONGOPTS --name "$0" -- "$@")
if [[ ${PIPESTATUS[0]} -ne 0 ]]; then
  # e.g. return value is 1
  #  then getopt has complained about wrong arguments to stdout
  exit 2
fi

# read getopt’s output this way to handle the quoting right:
eval set -- "$PARSED"

REMOVE_EXTENSION_UPDATE=false
REMOVE_UPDATE_CHANNELS=false
KEY=$(pwd)/dummy-chromium.pem
while true; do
  case "$1" in
    -e|--remove-extension-update)
      REMOVE_EXTENSION_UPDATE=true
      shift
      ;;
    -c|--remove-update-channels)
      REMOVE_UPDATE_CHANNELS=true
      shift
      ;;
    -k|--key)
      KEY="$2"
      shift 2
      ;;
    --)
      shift
      break
      ;;
    *)
      echo "Programming error"
      exit 3
      ;;
  esac
done

if [ "${KEY:0:1}" != "/" ]; then
  echo "Key must be specified as an absolute path."
  exit 4
fi

cd $(dirname $0)

if [ -n "$1" ]; then
  BRANCH=`git branch | head -n 1 | cut -d \  -f 2-`
  SUBDIR=checkout
  [ -d $SUBDIR ] || mkdir $SUBDIR
  cp -r -f -a .git $SUBDIR
  cd $SUBDIR
  git reset --hard "$1"
  git submodule update --recursive -f
fi

VERSION=`python3.6 -c "import json ; print(json.loads(open('../chromium/manifest.json').read())['version'])"`

echo "Building version" $VERSION

[ -d pkg ] || mkdir -p ../pkg
[ -e pkg/crx-opera ] && rm -rf ../pkg/crx-opera

# Clean up obsolete ruleset databases, just in case they still exist.
rm -f src/chrome/content/rules/default.rulesets src/defaults/rulesets.sqlite

mkdir -p ../pkg/crx-opera/rules
cd ../pkg/crx-opera
cp -a ../../chromium/* ./
# Turn the Firefox translations into the appropriate Chrome format:
rm -rf _locales/
mkdir _locales/
python3.6 ../../utils/chromium-translations.py ../../translations/ _locales/
python3.6 ../../utils/chromium-translations.py ../../src/chrome/locale/ _locales/
do_not_ship="*.py *.xml"
rm -f $do_not_ship

mkdir wasm
cp ../../lib-wasm/pkg/*.wasm wasm
cp ../../lib-wasm/pkg/*.js wasm

cd ../..

python3.6 ./utils/merge-rulesets.py || exit 5

cp src/chrome/content/rules/default.rulesets.json pkg/crx-opera/rules/default.rulesets.json

sed -i -e "s/VERSION/$VERSION/g" pkg/crx-opera/manifest.json

for x in `cat .build_exclusions`; do
  rm -rf pkg/crx-opera/$x
done

#Create Opera CRX caveat
cd pkg/crx-opera
sed -i 's/rules\/default.rulesets/rules\/default.rulesets.json/g' background-scripts/update.js
cd ../..

# Remove the 'applications' manifest key from the crx version of the extension, change the 'author' string to a hash, and add the "update_url" manifest key
# "update_url" needs to be present to avoid problems reported in https://bugs.chromium.org/p/chromium/issues/detail?id=805755
python3.6 -c "import json; m=json.loads(open('pkg/crx-opera/manifest.json').read()); m['author']={'email': 'eff.software.projects@gmail.com'}; del m['applications']; open('pkg/crx-opera/manifest.json','w').write(json.dumps(m,indent=4,sort_keys=True))"

# If the --remove-update-channels flag is set, remove all out-of-band update channels
if $REMOVE_UPDATE_CHANNELS; then
  echo "Flag --remove-update-channels specified.  Removing all out-of-band update channels."
  echo "require.scopes.update_channels.update_channels = [];" >> pkg/crx-opera/background-scripts/update_channels.js
fi

if [ -n "$BRANCH" ] ; then
  crx_opera="pkg/https-everywhere-$VERSION-opera.crx"
else
  crx_opera="pkg/https-everywhere-$VERSION-pre-opera.crx"
fi
if ! [ -f "$KEY" ] ; then
  echo "Making a dummy signing key for local build purposes"
  openssl genrsa -out /tmp/dummy-chromium.pem 768
  openssl pkcs8 -topk8 -nocrypt -in /tmp/dummy-chromium.pem -out $KEY
fi

# now pack the crx'es
BROWSER="chromium-browser"
which $BROWSER || BROWSER="chromium"

$BROWSER --no-message-box --pack-extension="pkg/crx-opera" --pack-extension-key="$KEY" 2> /dev/null

mv pkg/crx-opera.crx $crx_opera

echo >&2 "Opera crx package has sha256sum: `openssl dgst -sha256 -binary "$crx_opera" | xxd -p`"
echo >&2 "Total included rules: `find src/chrome/content/rules -name "*.xml" | wc -l`"
echo >&2 "Rules disabled by default: `find src/chrome/content/rules -name "*.xml" | xargs grep -F default_off | wc -l`"

echo "Created $crx_opera"

if [ -n "$BRANCH" ]; then
  cd ..
  cp $SUBDIR/$crx_opera pkg
  rm -rf $SUBDIR
fi
