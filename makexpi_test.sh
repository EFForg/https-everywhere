#!/bin/sh
cd "`dirname $0`"
XPI_NAME="pkg/test.xpi"

[ -d pkg ] || mkdir pkg

# The name/version of the XPI we're building comes from src/install.rdf
cd src

# Build the XPI!
rm -f "../$XPI_NAME"
#zip -q -X -9r "../$XPI_NAME" . "-x@../.build_exclusions"

python ../utils/create_xpi_test.py "../$XPI_NAME" "../.build_exclusions"

ret="$?"
if [ "$ret" != 0 ]; then
    rm -f "../$XPI_NAME"
    exit "$?"
fi
