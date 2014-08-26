#!/bin/sh
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

[ -d pkg ] || mkdir pkg

# If the command line argument is a tag name, check that out and build it
if [ -n "$1" ] && [ "$2" != "--no-recurse" ] && [ "$1" != "--fast" ] ; then
	BRANCH=`git branch | head -n 1 | cut -d \  -f 2-`
	SUBDIR=checkout
	[ -d $SUBDIR ] || mkdir $SUBDIR
	cp -r -f -a .git $SUBDIR
	cd $SUBDIR
	git reset --hard "$1"
  # Use the version of the build script that was current when that
  # tag/release/branch was made.
  ./makexpi.sh $1 --no-recurse || exit 1
  # The fact that the above works even when the thing you are building predates
  # support for --no-recurse in this script is (1) non-intuitive; (2) crazy; and (3)
  # involves two pristine checkouts of $1 within each other

  # Now escape from the horrible mess we've made
  cd ..
	XPI_NAME="$APP_NAME-$1.xpi"
  # In this mad recursive situation, sometimes old buggy build scripts make
  # the xpi as ./pkg :(
  if ! cp $SUBDIR/pkg/$XPI_NAME pkg/ ; then
    echo Recovering from hair-raising recursion:
    echo cp $SUBDIR/pkg pkg/$XPI_NAME
    cp $SUBDIR/pkg pkg/$XPI_NAME
  fi
  rm -rf $SUBDIR
  exit 0
fi

# =============== BEGIN VALIDATION ================
# Unless we're in a hurry, validate the ruleset library & locales

if [ "$1" != "--fast" ] ; then
  if [ -f utils/trivial-validate.py ]; then
    VALIDATE="python2.7 ./utils/trivial-validate.py --ignoredups google --ignoredups facebook"
  elif [ -f trivial-validate.py ] ; then
    VALIDATE="python2.7 trivial-validate.py --ignoredups google --ignoredups facebook"
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
    if find src/chrome/content/rules -name "*.xml" | xargs xmllint --noout --relaxng utils/relaxng.xml
    then
      echo Validation of rulesets with RELAX NG grammar completed. >&2
    else
      echo ERROR: Validation of rulesets with RELAX NG grammar failed. >&2
      exit 1
    fi
  else
    echo Validation of rulesets with RELAX NG grammar was SKIPPED. >&2
  fi 2>&1 | grep -v validates

  if [ -x ./utils/compare-locales.sh ] >&2
  then
    if ./utils/compare-locales.sh >&2
    then
      echo Validation of included locales completed. >&2
    else
      echo ERROR: Validation of locales failed. >&2
      exit 1
    fi
  fi
fi
# =============== END VALIDATION ================

if [ "$1" != "--fast" -o ! -f "$RULESETS_SQLITE" ] ; then
  echo "Generating sqlite DB"
  python2.7 ./utils/make-sqlite.py src/chrome/content/rules
fi

# The name/version of the XPI we're building comes from src/install.rdf
XPI_NAME="pkg/$APP_NAME-`grep em:version src/install.rdf | sed -e 's/[<>]/	/g' | cut -f3`"
if [ "$1" ] && [ "$1" != "--fast" ] ; then
	XPI_NAME="$XPI_NAME.xpi"
else
	XPI_NAME="$XPI_NAME~pre.xpi"
fi

[ -d pkg ] || mkdir pkg

# Used for figuring out which branch to pull from when viewing source for rules
GIT_OBJECT_FILE=".git/refs/heads/master"
export GIT_COMMIT_ID="HEAD"
if [ -e "$GIT_OBJECT_FILE" ]; then
	export GIT_COMMIT_ID=$(cat "$GIT_OBJECT_FILE")
fi

cd src


# Build the XPI!
rm -f "../$XPI_NAME"
#zip -q -X -9r "../$XPI_NAME" . "-x@../.build_exclusions"

python2.7 ../utils/create_xpi.py -n "../$XPI_NAME" -x "../.build_exclusions" "."

ret="$?"
if [ "$ret" != 0 ]; then
    rm -f "../$XPI_NAME"
    exit "$?"
else
  echo >&2 "Total included rules: `sqlite3 $RULESETS_SQLITE 'select count(*) from rulesets'`"
  echo >&2 "Rules disabled by default: `find chrome/content/rules -name "*.xml" | xargs grep -F default_off | wc -l`"
  echo >&2 "Created $XPI_NAME"

  # Push to Android Firefox if device is connected
  # XXX on some systems, adb may require sudo...
  if type adb > /dev/null && adb devices > /dev/null 2>/dev/null ; then
    ADB_FOUND=`adb devices | tail -2 | head -1 | cut -f 1 | sed 's/ *$//g'`
    if [ "$ADB_FOUND" != "List of devices attached" ]; then
      echo Pushing "$XPI_NAME" to /sdcard/"$XPI_NAME"
      adb push "../$XPI_NAME" /sdcard/"$XPI_NAME"
      adb shell am start -a android.intent.action.VIEW \
                         -c android.intent.category.DEFAULT \
                         -d file:///mnt/sdcard/"$XPI_NAME" \
                         -n $ANDROID_APP_ID/.App
    fi
  fi

  if [ -n "$BRANCH" ]; then
    cd ../..
    cp $SUBDIR/$XPI_NAME pkg
    rm -rf $SUBDIR
  fi
fi
