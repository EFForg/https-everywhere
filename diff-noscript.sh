#!/bin/sh

# Used to import upstream changes to the NoScript code that use for request
# rewriting.

FROM=../noscript-2.0.5.1
TO=../noscript-2.0.9.8rc1

for i in ./src/chrome/content/code/*.js
do
  name=`basename $i`
  diff -u $FROM/chrome/content/noscript/$name $TO/chrome/content/noscript/$name
done
