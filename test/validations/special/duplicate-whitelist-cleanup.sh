#!/bin/sh

TMPFILE=`mktemp /tmp/buffer.XXXXXXXX`
trap 'rm "$TMPFILE"' EXIT

for host in `cat utils/duplicate-whitelist.txt`; do
    REPEATS=`grep -F "target host=\"$host\"" src/chrome/content/rules/*.xml | wc -l`
    if [ $REPEATS -gt 1 ]; then
        echo $host
    fi
done > $TMPFILE

cp --force $TMPFILE utils/duplicate-whitelist.txt
