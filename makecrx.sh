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
RULESETS_SQLITE="$PWD/src/defaults/rulesets.sqlite"

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

# Build the SQLite DB even though we don't yet use it in the Chrome extension,
# because trivial-validate.py depends on it.
if [ "$1" != "--fast" -o ! -f "$RULESETS_SQLITE" ] ; then
  echo "Generating sqlite DB"
  python2.7 ./utils/make-sqlite.py
fi

# =============== BEGIN VALIDATION ================
# Unless we're in a hurry, validate the ruleset library & locales

die() {
  echo >&2 "ERROR:" "$@"
  exit 1
}

if [ "$1" != "--fast" ] ; then
  if python2.7 ./utils/trivial-validate.py --quiet --db $RULESETS_SQLITE >&2
  then
    echo Validation of included rulesets completed. >&2
    echo >&2
  else
    die "Validation of rulesets failed."
  fi

  # Check for xmllint.
  type xmllint >/dev/null || die "xmllint not available"

  GRAMMAR="utils/relaxng.xml"
  if [ -f "$GRAMMAR" ]
  then
    # xmllint spams stderr with "<FILENAME> validates, even with the --noout
    # flag. We can't grep -v for that line, because the pipeline will mask error
    # status from xmllint. Instead we run it once going to /dev/null, and if
    # there's an error run it again, showing only error output.
    validate_grammar() {
      find src/chrome/content/rules -name "*.xml" | \
       xargs xmllint --noout --relaxng utils/relaxng.xml
    }
    if validate_grammar 2>/dev/null
    then
      echo Validation of rulesets against $GRAMMAR succeeded. >&2
    else
      validate_grammar 2>&1 | grep -v validates
      die "Validation of rulesets against $GRAMMAR failed."
    fi
  else
    echo Validation of rulesets against $GRAMMAR SKIPPED. >&2
  fi

  if [ -x ./utils/compare-locales.sh ] >&2
  then
    if ./utils/compare-locales.sh >&2
    then
      echo Validation of included locales completed. >&2
    else
      die "Validation of locales failed."
    fi
  fi
fi
# =============== END VALIDATION ================

sed -e "s/VERSION/$VERSION/g" chromium/updates-master.xml > chromium/updates.xml

[ -d pkg ] || mkdir -p pkg
[ -e pkg/crx ] && rm -rf pkg/crx
mkdir -p pkg/crx/rules
cd pkg/crx
cp -a ../../chromium/* .
do_not_ship="*.py *.xml icon.jpg"
rm -f $do_not_ship
cd ../..

. ./utils/merge-rulesets.sh || exit 1

cp src/$RULESETS pkg/crx/rules/default.rulesets

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
(cd "$dir" && ../../utils/create_xpi.py -n "$cwd/$zip" -x "../../.build_exclusions" .)
echo >&2 "Unsigned package has shasum: `shasum "$cwd/$zip"`" 

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
  echo "$crmagic_hex $version_hex $pub_len_hex $sig_len_hex" | sed -e 's/\s//g' -e 's/\([0-9A-F]\{2\}\)/\\\\\\x\1/gI' | xargs printf
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
