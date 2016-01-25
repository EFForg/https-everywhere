#!/bin/sh
set -eu;

# For an XPI passed on the command line, check whether all locale directories
# listed in the manifest include every entity defined in the English locale DTDs.
# (Missing an entity is a fatal error.)

status=0;

TMPDIR="`mktemp -d -t helocalesXXXX`"
trap 'rm -r "${TMPDIR}"' EXIT
unzip -qd "${TMPDIR}" "$1" chrome/locale/* chrome.manifest
cd ${TMPDIR}/chrome/locale/;

LANGS="`sed -n 's,^locale https-everywhere .* chrome/locale/\(.*\)/$,\1,p' ${TMPDIR}/chrome.manifest`"
grep '^<!ENTITY' en/* | cut -d' ' -f2 | sort -u > ${TMPDIR}/en_entities;

lang_entities_list() {
   grep '^<!ENTITY' "$lang/"* | cut -d' ' -f2 | sort -u;
}

compare_lang() {
   comm -2 -3 -- ${TMPDIR}/en_entities -;
}

for lang in *; do
   lang_entities_list | compare_lang | grep . && echo "\_ missing for locale" "$lang" && status=1;
done;

exit "$status";
