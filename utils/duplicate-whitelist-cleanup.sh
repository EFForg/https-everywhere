#! /bin/sh

cat utils/duplicate-whitelist.txt | while read -r line; do
    REPEATS=`grep "target host=\"$line\"" src/chrome/content/rules/*.xml | wc -l`
    if [ "$REPEATS" -gt "1" ]; then
        echo "$line"
    fi
done >| utils/duplicate-whitelist.txt
