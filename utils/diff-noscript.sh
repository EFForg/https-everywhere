#!/bin/sh

# Used to import upstream changes to the NoScript code that use for request
# rewriting.

# The merging process is roughly this:
# 0. Download noscript xpi's or git checkouts corresponding to the last
#    merge version and the current merge version.
# 1. Update the FROM and TO versions appropriately below.
# 2  execute:
#    ./utils/diff-noscript.sh > noscript-merge.diff
#    cd ./src/chrome/content/code/
#    patch -p4 < ../../../../noscript-merge.diff
# 3. Clean up the mess.
# 4. Manually extract the IOUtil, Thread, and IO objects from 
#    $TO/components/noscriptservice.js and drop them into 
#    the corresponding js files in ./src/chrome/content/code/.
#
# Note: This whole process can be likely simplified a bit. You
# might be able to get away with simply copying ChannelReplacement.js
# from newer NoScript versions, since I believe we've taken a more
# active ownership of the rest of the files and we've diverged quite
# a bit.

FROM=../noscript-2.0.9.8rc1
TO=../noscript-2.3.7

for i in ./src/chrome/content/code/*.js
do
  name=`basename $i`
  diff -u $FROM/chrome/content/noscript/$name $TO/chrome/content/noscript/$name
done
