#!/bin/bash

# Script to build transitive closure of valid intermediate and root certificates
# from a starting set of "trusted" ones and a set of intermediate CA ones.
# See usage() below for invocation.

# IMPORTANT: You MUST compile openssl from source, otherwise it may take trust
# anchors from some distribution bundle (I didn't find a switch to turn it off
# Use latest stable openssl from openssl.org (I tested with 1.0.1c).

OPENSSL="$HOME/tmp/openssl_raw/bin/openssl"

usage() {
    cat << EOF
Usage: $0 trusted_certs_dir intermediate_certs_dir output_dir

Upon finishing, "output_dir" will contain all certificates from
"trusted_certs_dir" with all the certificates from "intermediate_certs_dir" that
can be transitively validated.

All certs are expected in PEM format with ".pem" extension (lowercase).

Note: this script will first run openssl's c_rehash on "trusted_certs_dir", so
symlinks will be added there.
EOF
}

# print $@ and die with exitcode 1
fatal() {
    echo "$@"
    exit 1
}

# Rehash certs for openssl's use in directory given as arg1
rehash_dir() {
    perl "$REHASH" "$1" > /dev/null
}

if [ "$#" -lt 3 ]; then
    usage
    exit 1
fi

TRUSTED_DIR="$1"
INTERMEDIATE_DIR="$2"
OUTPUT_DIR="$3"

SCRIPT_DIR="${0%/*}"
REHASH="$SCRIPT_DIR/c_rehash"
UNIQUE_CERTS="$SCRIPT_DIR/unique_certs.py"
ROUND=1 # iteration index
ROUND_NEW_CERTS=0 # number of new certs found in the round
ROUND_TA_DIR="$TRUSTED_DIR" # trust anchor dir for round
WORKDIR=$(mktemp -d closure_workdir.XXXX)

echo "=== Starting, workdir is $WORKDIR"
#echo "=== Rehashing source dir $TRUSTED_DIR"
#rehash_dir "$TRUSTED_DIR"

mkdir -p "$OUTPUT_DIR" || fatal "Can't create output dir and it's not directory - $OUTPUT_DIR"

# Loop until no new transitively trusted certs are found
while [ "$ROUND_NEW_CERTS" -gt 0 -o "$TRUSTED_DIR" = "$ROUND_TA_DIR" ]; do
    ROUND_NEW_CERTS=0
    echo "=== Starting round $ROUND"
    ROUND_OUT_DIR="$WORKDIR/round_${ROUND}"
    mkdir -p "$ROUND_OUT_DIR"
    echo "  \- Copying previous round certs from $ROUND_TA_DIR to $ROUND_OUT_DIR"
    find "$ROUND_TA_DIR" -name "*.pem" -exec cp {} "$ROUND_OUT_DIR" ';'
    echo "  \- Rehash previous round certs in $ROUND_TA_DIR"
    rehash_dir "$ROUND_TA_DIR"

    # Iterate over unique certs not yet in partial closure
    # ...the for cycle below is ugly and has limit on cert count but while runs
    # in a subshell (can't get variables out)
    for TESTED_CERT in $(python "$UNIQUE_CERTS" "$INTERMEDIATE_DIR" "$ROUND_TA_DIR"); do
        # TODO:
        # - we should check against untrusted like Diginotar
        # - openssl verify has "-purpose" option, but doesn't seem to work
        # - find out if there's a way to disable built-in certbundle other than
        #   compile openssl locally
        # - time checks are not done unless '-attime' is used, but it shouldn't
        #   matter for our purpose
        # - the method of grepping for 'error' is crude, but exit code is
        #   meaningless
    	ERROR_COUNT=$("$OPENSSL" verify -CApath "$ROUND_TA_DIR" "$TESTED_CERT" 2>&1 | grep -ci error)

        if [ "$ERROR_COUNT" -eq 0 ]; then #chain validated
            echo "    \- Found $TESTED_CERT to be transitively trusted"
            cp "$TESTED_CERT" "$ROUND_OUT_DIR"
            ROUND_NEW_CERTS=$(($ROUND_NEW_CERTS+1))
        fi
    done
    
    ROUND_TA_DIR="$ROUND_OUT_DIR"
    ROUND=$((ROUND+1))
done

echo "=== Finished at round $ROUND"
echo " \- Last round dir with transitive closure is $ROUND_TA_DIR, copying to $OUTPUT_DIR"
find "$ROUND_TA_DIR" -name "*.pem" -type f -exec cp {} "$OUTPUT_DIR" ';'

#rm -r "$WORKDIR"
