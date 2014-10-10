#!/bin/sh

set -eu;

# Check whether all included rules include every entity defined in the
# English locale DTDs.  (Missing an entity is a fatal error.)

status=0;

cd src/chrome/locale;

grep '^<!ENTITY' en/* | cut -d' ' -f2 | sort -u > ../en_entities;

lang_entities_list() {
   grep '^<!ENTITY' "$lang/"* | cut -d' ' -f2 | sort -u;
}

compare_lang() {
   comm -2 -3 -- ../en_entities -;
}

for lang in *; do
   lang_entities_list | compare_lang | grep . && echo "\_ missing for locale" "$lang" && status=1;
done;

rm ../en_entities;

exit "$status";
