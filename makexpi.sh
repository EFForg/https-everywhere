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

cd "$(dirname $0)"

if [ -n "$1" ]; then
	BRANCH=$(git branch | head -n 1 | cut -d \  -f 2-)
	SUBDIR=checkout
	[ -d $SUBDIR ] || mkdir $SUBDIR
	cp -r -a .git $SUBDIR
	cd $SUBDIR
	git reset --hard "$1"
fi

if ./trivial-validate src/chrome/content/rules >&2
then
  echo Validation of included rulesets completed. >&2
  echo >&2
else
  echo ERROR: Validation of rulesets failed. >&2
  exit 1
fi

if [ -n "$1" ]; then
    VERSION="$1"
else
    VERSION="$(grep em:version src/install.rdf | sed -e 's/[<>]/	/g' | cut -f3)~pre"
fi

XPI_NAME="pkg/$APP_NAME-$VERSION.xpi"
mkdir -p $XPI_NAME
rmdir $XPI_NAME

cd "src"
echo "<rulesetlibrary>" > chrome/content/rules/default.rulesets
cat chrome/content/rules/*.xml >> chrome/content/rules/default.rulesets
echo "</rulesetlibrary>" >> chrome/content/rules/default.rulesets
echo "Removing whitespaces and comments..."
sed -i -e :a -re 's/<!--.*?-->//g;/<!--/N;//ba' chrome/content/rules/default.rulesets
sed -i ':a;N;$!ba;s/\n//g' chrome/content/rules/default.rulesets
sed -i 's/>[ 	]*</></g' chrome/content/rules/default.rulesets
sed -i 's/[ 	]*to=/ to=/g' chrome/content/rules/default.rulesets
sed -i 's/[ 	]*from=/ from=/g' chrome/content/rules/default.rulesets
sed -i 's/ \/>/\/>/g' chrome/content/rules/default.rulesets
touch -r chrome/content/rules chrome/content/rules/default.rulesets
rm -f "../$XPI_NAME"
zip -q -X -9r "../$XPI_NAME" . "-x@../.build_exclusions"

ret="$?"
if [ "$ret" != 0 ]; then
    rm -f "../$XPI_NAME"
    exit "$?"
else
  printf >&2 "Total included rules: $(find -wholename "chrome/content/rules/*.xml" -printf ' ' | wc -c)\n"
  printf >&2 "Rules disabled by default: $(grep -lrc default_off chrome/content/rules)\n"
  printf >&2 "Created %s\n" "$XPI_NAME"
  if [ -n "$BRANCH" ]; then
    cd ../..
    cp $SUBDIR/$XPI_NAME pkg
    rm -rf $SUBDIR
  fi
fi
