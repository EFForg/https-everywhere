#!/bin/sh

for host in `cat utils/duplicate-whitelist.txt`; do
    REPEATS=`grep -F "target host=\"$host\"" src/chrome/content/rules/*.xml | cat | wc -l`
    if [ "$REPEATS" -gt "1" ]; then
        echo "$host"
    fi
done >| utils/duplicate-whitelist.txt
