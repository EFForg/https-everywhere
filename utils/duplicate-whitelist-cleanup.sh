#!/bin/sh

cat utils/duplicate-whitelist.txt | while read -r host; do
    REPEATS=`grep -F "target host=\"$host\"" src/chrome/content/rules/*.xml | cat | wc -l`
    if [ "$REPEATS" -gt "1" ]; then
        echo "$host"
    fi
done >| utils/duplicate-whitelist.txt
