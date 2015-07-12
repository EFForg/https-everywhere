#!/bin/bash
set -o errexit
APP_NAME=https-everywhere

# builds a .xpi from the git repository, placing the .xpi in the root
# of the repository.
#
# invoke with no arguments to build from the current src directory.
#
#  ./makexpi.sh
#
# OR, invoke with a tag name to build a specific branch or tag.
#
# e.g.:
#
#  ./makexpi.sh 0.2.3.development.2

cd "`dirname $0`"
RULESETS_SQLITE="$PWD/src/defaults/rulesets.sqlite"
ANDROID_APP_ID=org.mozilla.firefox
if [ "$1" == "--fast" ]; then
  FAST=true
fi

[ -d pkg ] || mkdir pkg

# If the command line argument is a tag name, check that out and build it
if [ -n "$1" ] && [ "$2" != "--no-recurse" ] && [ -z "$FAST" ] ; then
  BRANCH=`git branch | head -n 1 | cut -d \  -f 2-`
  SUBDIR=checkout
  [ -d $SUBDIR ] || mkdir $SUBDIR
  cp -r -f -a .git $SUBDIR
  cd $SUBDIR
  git reset --hard "$1"
  # When a file is renamed, the old copy can linger in the checkout directory.
  # Ensure a clean build.
  git clean -fdx

  # Use the version of the build script that was current when that
  # tag/release/branch was made.
  ./makexpi.sh $1 --no-recurse || exit 1
  # The fact that the above works even when the thing you are building predates
  # support for --no-recurse in this script is (1) non-intuitive; (2) crazy; and (3)
  # involves two pristine checkouts of $1 within each other

  # Now escape from the horrible mess we've made
  cd ..
  XPI_NAME="$APP_NAME-$1"
  cp $SUBDIR/pkg/$XPI_NAME.xpi pkg/
  if ! cp $SUBDIR/pkg/$XPI_NAME-amo.xpi pkg/ 2> /dev/null ; then
    echo Old version does not support AMO
  fi
  rm -rf $SUBDIR
  exit 0
fi

if [ -z "$FAST" -o ! -f "$RULESETS_SQLITE" ] ; then
  # This is an optimization to get the OS reading the rulesets into RAM ASAP;
  # it's useful on machines with slow disk seek times; doing several of these
  # at once allows the IO subsystem to seek more efficiently.
  for firstchar in `echo {a..z} {A..Z} {0..9}` ; do
    # Those cover everything but it wouldn't matter if they didn't
    nohup cat src/chrome/content/rules/"$firstchar"*.xml >/dev/null 2>/dev/null &
  done

  echo "Generating sqlite DB"
  python2.7 ./utils/make-sqlite.py
fi

# =============== BEGIN VALIDATION ================
# Unless we're in a hurry, validate the ruleset library & locales

die() {
  echo >&2 "ERROR:" "$@"
  exit 1
}

if [ -z "$FAST" ] ; then
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
    if sh ./utils/compare-locales.sh >&2
    then
      echo Validation of included locales completed. >&2
    else
      die "Validation of locales failed."
    fi
  fi
fi
# =============== END VALIDATION ================

# The name/version of the XPI we're building comes from src/install.rdf
XPI_NAME="pkg/$APP_NAME-`grep em:version src/install.rdf | sed -e 's/[<>]/	/g' | cut -f3`"
if [ "$1" -a -z "$FAST" ] ; then
  XPI_NAME="$XPI_NAME"
else
  # During development, generate packages named with the short hash of HEAD.
  XPI_NAME="$XPI_NAME~`git rev-parse --short HEAD`"
        if ! git diff-index --quiet HEAD; then
            XPI_NAME="$XPI_NAME-dirty"
        fi
fi

# Prepare packages suitable for uploading to EFF and AMO, respectively.
[ -d pkg ] || mkdir pkg
[ -e pkg/xpi-eff ] && rm -rf pkg/xpi-eff
cp -a src/ pkg/xpi-eff/
rm -r pkg/xpi-eff/chrome/content/rules
[ -e pkg/xpi-amo ] && rm -rf pkg/xpi-amo
cp -a src/ pkg/xpi-amo/
rm -r pkg/xpi-amo/chrome/content/rules
# The AMO version of the package cannot contain the updateKey or updateURL tags
sed -i.bak -e '/updateKey/d' -e '/updateURL/d' pkg/xpi-amo/install.rdf
rm pkg/xpi-amo/install.rdf.bak

# Used for figuring out which branch to pull from when viewing source for rules
GIT_OBJECT_FILE=".git/refs/heads/master"
export GIT_COMMIT_ID="HEAD"
if [ -e "$GIT_OBJECT_FILE" ]; then
	export GIT_COMMIT_ID=$(cat "$GIT_OBJECT_FILE")
fi

# Build the XPI!
rm -f "${XPI_NAME}.xpi"
rm -f "${XPI_NAME}-amo.xpi"
python2.7 utils/create_xpi.py -n "${XPI_NAME}.xpi" -x ".build_exclusions" "pkg/xpi-eff"
python2.7 utils/create_xpi.py -n "${XPI_NAME}-amo.xpi" -x ".build_exclusions" "pkg/xpi-amo"

echo >&2 "Total included rules: `sqlite3 $RULESETS_SQLITE 'select count(*) from rulesets'`"
echo >&2 "Rules disabled by default: `find src/chrome/content/rules -name "*.xml" | xargs grep -F default_off | wc -l`"
echo >&2 "Created ${XPI_NAME}.xpi and ${XPI_NAME}-amo.xpi"

bash utils/android-push.sh "$XPI_NAME.xpi"

if [ -n "$BRANCH" ]; then
  cp $SUBDIR/$XPI_NAME.xpi pkg
  rm -rf $SUBDIR
fi
