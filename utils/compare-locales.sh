#!/usr/bin/env bash

# Check whether all included rules include every entity defined in the
# English locale DTDs.  (Missing an entity is a fatal error.)

# Requires bash in order to avoid making temporary files.  We could
# change this but we'd probably need to create temporary files.

status=0

pushd src/chrome/locale
for lang in *
do
   comm -2 -3 <(grep '^<!ENTITY' en/* | cut -d' ' -f2 | sort -u) <(grep '^<!ENTITY' $lang/* | cut -d' ' -f2 | sort -u) | grep . && echo "\_ missing for locale" $lang && status=1
done

exit $status
