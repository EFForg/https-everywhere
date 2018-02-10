#!/bin/sh

TMPFILE=`mktemp /tmp/buffer.XXXXXXXX`
trap 'rm "$TMPFILE"' EXIT

for host in `cat test/validations/special/duplicate-whitelist.txt`; do
    REPEATS=`egrep -l "<target\s+host=\s*\"$host\"\s*/>" src/chrome/content/rules/*.xml | wc -l`
    if [ $REPEATS -gt 1 ]; then
        echo $host
    fi
done > $TMPFILE

cp --force $TMPFILE test/validations/special/duplicate-whitelist.txt
