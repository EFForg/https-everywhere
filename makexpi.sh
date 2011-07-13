#!/bin/sh
APP_NAME=https-everywhere

# builds a .xpi from the git repository, placing the .xpi in the root
# of the repository.

# invoke with no arguments to pull a prerelease of the current
# development point.

# invoke with the literal argument "uncommitted" to build from the
# current src directory.

# invoke with a tag name to build a specific branch or tag.

# e.g.:
#  ./makexpi.sh 0.2.3.development.2

# or just:
#  ./makexpi.sh

# BUGS: if you have a branch or tagged named "uncommitted" then this
# is kind of ambiguous.  Also, the validation of rule syntax is done
# against the rules in the current directory, not necessarily the
# committed rules in git.

cd "$(dirname $0)"

if ./trivial-validate src/chrome/content/rules >&2
then
  echo Validation of included rulesets completed. >&2
  echo >&2
else
  echo ERROR: Validation of rulesets failed. >&2
  exit 1
fi

if [ -n "$1" ] && [ "$1" != "uncommitted" ]; then
    VERSION="$1"
    TARG="$1"
else
    VERSION="$(grep em:version src/install.rdf | sed -e 's/[<>]/	/g' | cut -f3)~pre"
    TARG=HEAD
    if [ "$1" != "uncommitted" ] && [ -n "$(git status src -s)" ] ; then
        printf >&2 "\
WARNING: There are uncommitted changes in your current repostitory.
WARNING: These changes will not be included in the generated .xpi
WARNING: Run 'git status' for information about the uncommitted changes.
WARNING: Or, use 'makexpi.sh uncommitted' to include them in the build.
" 
    fi
fi

XPI_NAME="pkg/$APP_NAME-$VERSION.xpi"
[ -d pkg ] || mkdir pkg

cd "src"
echo "<rulelibrary>" > chrome/content/rules/default.rulesets
cat chrome/content/rules/*.xml >> chrome/content/rules/default.rulesets
echo "</rulelibrary>" >> chrome/content/rules/default.rulesets
rm -f "../$XPI_NAME"
if [ -n "$CHANGES" ]; then
    printf >&2 "WARNING: uncommitted changes were included:\n%s\n" "$CHANGES"
fi
zip -v -X -9r "../$XPI_NAME" . "-x@../.build_exclusions"

ret="$?"
if [ "$ret" != 0 ]; then
    rm -f "../$XPI_NAME"
    exit "$?"
else
  printf >&2 "Total included rules: $(ls chrome/content/rules/*.xml | wc -l)\n"
  printf >&2 "Rules disabled by default: $(grep -lr default_off chrome/content/rules | wc -l)\n"
  printf >&2 "Created %s\n" "$XPI_NAME"
fi
