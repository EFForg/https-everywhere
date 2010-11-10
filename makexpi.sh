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
# is kind of ambiguous.

cd "$(dirname $0)"

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

cd "src"
if [ "$1" = "uncommitted" ]; then
    printf >&2 "WARNING: using zip instead of git archive to build .xpi\n"
    CHANGES="$(git status . -s)"
    if [ -n "$CHANGES" ]; then
        printf >&2 "WARNING: uncommitted changes were included:\n%s\n" "$CHANGES"
    fi
    # FIXME: is it really acceptable to reuse .gitignore to specify
    # include patterns for /usr/bin/zip?  It seems to work for our
    # current patterns (2010-11-09)
    zip -X -q -9r "../$XPI_NAME" . "-x@../.gitignore"
else
    git archive --format=zip -9 "$TARG" . > "../$XPI_NAME"
fi

ret="$?"
if [ "$ret" != 0 ]; then
    rm -f "../$XPI_NAME"
    exit "$?"
else
  printf >&2 "Created %s\n" "$XPI_NAME"
fi
