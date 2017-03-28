#! /bin/sh

cat utils/duplicate-whitelist.txt | while read -r line; do
    REPEATS=`grep -F "target host=\"$line\"" src/chrome/content/rules/*.xml | cat | wc -l`
    if [ "$REPEATS" -gt "1" ]; then
        echo "$line"
    fi
done >| utils/duplicate-whitelist.txt
