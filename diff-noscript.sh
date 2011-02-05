#!/bin/sh

FROM=../noscript-2.0.5.1
TO=../noscript-2.0.9.8rc1

for i in ./src/chrome/content/code/*.js
do
  name=`basename $i`
  diff -u $FROM/chrome/content/noscript/$name $TO/chrome/content/noscript/$name
done
