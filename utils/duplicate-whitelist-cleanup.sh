#!/bin/sh

for host in `cat utils/duplicate-whitelist.txt`; do
    REPEATS=`grep -F "target host=\"$host\"" src/chrome/content/rules/*.xml | wc -l`
    if [ $REPEATS -gt 1 ]; then
        echo $host
    fi
done >| temp.txt

mv --force temp.txt utils/duplicate-whitelist.txt
