#!/bin/sh
APP_NAME=https-everywhere

# builds a .xpi from the git repository, placing the .xpi in the root
# of the repository.

# invoke with no arguments to build from the current src directory.

# invoke with a tag name to build a specific branch or tag.

# e.g.:
#  ./makexpi.sh 0.2.3.development.2

# or just:
#  ./makexpi.sh

cd "`dirname $0`"

if [ -n "$1" ]; then
	BRANCH=`git branch | head -n 1 | cut -d \  -f 2-`
	SUBDIR=checkout
	[ -d $SUBDIR ] || mkdir $SUBDIR
	cp -r -f -a .git $SUBDIR
	cd $SUBDIR
	git reset --hard "$1"
fi

if [ -x trivial-validate.py ]; then
	VALIDATE=./trivial-validate.py
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

if [ -x ./compare-locales.sh ] >&2
then
  if ./compare-locales.sh >&2
  then
    echo Validation of included locales completed. >&2
  else
    echo ERROR: Validation of locales failed. >&2
    exit 1
  fi
fi

XPI_NAME="pkg/$APP_NAME-`grep em:version src/install.rdf | sed -e 's/[<>]/	/g' | cut -f3`"
if [ "$1" ]; then
	XPI_NAME="$XPI_NAME.xpi"
else
	XPI_NAME="$XPI_NAME~pre.xpi"
fi

[ -d pkg ] || mkdir pkg

cd src
RULESETS=chrome/content/rules/default.rulesets
echo "<rulesetlibrary>" > $RULESETS
cat chrome/content/rules/*.xml >> $RULESETS
echo "</rulesetlibrary>" >> $RULESETS
echo "Removing whitespaces and comments..."
rulesize() {
	echo `wc -c $RULESETS | cut -d \  -f 1`
}
CRUSH=`rulesize`
sed -i -e :a -re 's/<!--.*?-->//g;/<!--/N;//ba' $RULESETS
sed -i ':a;N;$!ba;s/\n//g;s/>[ 	]*</></g;s/[ 	]*to=/ to=/g;s/[ 	]*from=/ from=/g;s/ \/>/\/>/g' $RULESETS
echo "Crushed $CRUSH bytes of rulesets into `rulesize`"
touch -r chrome/content/rules $RULESETS
rm -f "../$XPI_NAME"
zip -q -X -9r "../$XPI_NAME" . "-x@../.build_exclusions"

ret="$?"
if [ "$ret" != 0 ]; then
    rm -f "../$XPI_NAME"
    exit "$?"
else
  echo >&2 "Total included rules: `find chrome/content/rules -name "*.xml" | wc -l`"
  echo >&2 "Rules disabled by default: `find chrome/content/rules -name "*.xml" | xargs grep -F default_off | wc -l`"
  echo >&2 "Created $XPI_NAME"
  if [ -n "$BRANCH" ]; then
    cd ../..
    cp $SUBDIR/$XPI_NAME pkg
    rm -rf $SUBDIR
  fi
fi
