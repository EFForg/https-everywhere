#!/bin/sh

TMPFILE=`mktemp /tmp/buffer.XXXXXXXX`
trap 'rm "$TMPFILE"' EXIT

for host in `cat test/validations/special/duplicate-whitelist.txt`; do
    REGEX_ESCAPED_HOST=`python3.6 -c "import re; print(re.escape('$host'))"`
    REPEATS=`egrep -l "<target\s+host=\s*\"$REGEX_ESCAPED_HOST\"\s*/>" src/chrome/content/rules/*.xml | wc -l`
    if [ $REPEATS -gt 1 ]; then
        echo $host
    fi
done > $TMPFILE

cp --force $TMPFILE test/validations/special/duplicate-whitelist.txt
