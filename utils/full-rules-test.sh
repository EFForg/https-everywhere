#!/bin/bash

# Undo whitelisting from `rules-test` if possible

# Change directory to git root; taken from ../test/rules.sh
if [ -n "$GIT_DIR" ]
then
    # $GIT_DIR is set, so we're running as a hook.
    cd $GIT_DIR
else
    # Git command exists? Cool, let's CD to the right place.
    git rev-parse && cd "$(git rev-parse --show-toplevel)"
fi

RULES_DIR="./src/chrome/content/rules"
UTILS_DIR="./utils"

DELIM=","
WLIST="$UTILS_DIR/ruleset-whitelist.csv"

AUTOPASS_L="$(mktemp)"
AUTOPASS_R="$(mktemp)"
TRAVIS_LOG="$(mktemp)"

ITEMS="$(mktemp)"

# (1) Modify all files whitelisted from `rules-test`
(read; while IFS=$DELIM read _ autopass1 _ filename; do
	if [ $autopass1 -eq 1 ] && [ -f "$RULES_DIR/$filename" ] ; then
		echo "$filename" >> $AUTOPASS_L
		echo >> "$RULES_DIR/$filename"
	fi
done) < "$WLIST" 

sort -u $AUTOPASS_L -o $AUTOPASS_L

# (2) Travis `rules-test`
export TEST=rules
git commit -a -m '**DO NOT MERGE** Perform Travis `rules-test`'

./test.sh 2>&1 >/dev/null | sed 's/ERROR src\/chrome\/content\/rules\/\([^:]*\).*/\1/g' | sort -u >> $AUTOPASS_R

# (3) Reset to origin/master
git reset --hard origin/master

# (4) Update $WLIST
comm -2 -3 $AUTOPASS_L $AUTOPASS_R | while read filename; do
	grep "$filename" "$WLIST"
done > $ITEMS

while IFS=$DELIM read lhash autopass1 autopass2 filename; do
	sed -i "s/$lhash,$autopass1,$autopass2,$filename/$lhash,0,$autopass2,$filename/g" $WLIST
done < $ITEMS

# (5) commit to current branch
git commit -a -m 'Remove false-positive from ruleset-whitelist.csv (full-rules-test)'
