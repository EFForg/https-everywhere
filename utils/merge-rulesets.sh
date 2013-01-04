#!/bin/sh

# Merge all the .xml rulesets into a single "default.rulesets" file -- this
# prevents inodes from wasting disk space, but more importantly, works around
# the fact that zip does not perform well on a pile of small files.

RULESETS=chrome/content/rules/default.rulesets

INDENT_CHAR='    '
# Any whitespace that marks one level of indentation.

TAG_DEFINITIONS='
# tag | level of indentation | + prepended linebreaks | + appended linebreaks
rulesetlibrary  0 -1  0
ruleset         0  1  0
rule            1  0  0
target          1  0  0
exclusion       2  0  0
securecookie    2  0  0'
# Extra prepended linebreaks are added before the opening <tags>,
# and appended after closing </tags> and <tags/>. It's not perfect but it works.
# One linebreak is implicitly prepended; opt out by supplying -1
# This does not work whatsoever with nested tags, mind.

SED_TRIM_CMD='
	:a
	s/<!--.*-->//g
	/<!--/N
	//ba

	s/\([^ ]\)\(to\|from\|name\)=/\1 \2=/g
	s: />:/>:g
	s/\([^ ]\) \{2,\}/\1/g
	s/ \+$//g
	s:\(http[s?]\{,2\}\)[^:]//:\1\://:g
	s:\([^:]\)/\{2,\}:\1/:g'
# sed command to scrub comments and fix various whitespace irregularities;
# missing whitespace inbetween tag fields: <x y="z"trapped=":("/>,
# random double and trailing whitespace, unwanted whitespace before '/>',
# semicolons after protocols;// (rather than colons), and mid-URI double slashes


# Functions

repeat_char() {
	[ $2 -gt 0 ] || return
	local i
	for i in $(seq 1 $2); do printf "$1"; done
}

format_rulesets() {
	local IFS tag idepth prebreaks postbreaks
	local _indent _pre _post _sed_pre _sed_post _sed_oneshot

	# Print pretty banner, very hardcoded
	printf '\n'
	printf '%15s | %s | %s | %s\n' 'tag name' 'indent' 'prebreak' 'postbreak'
	printf '%15s-+-%s-+-%s-+-%s\n' \
		'-------------' '------' '--------' '----------'

	# Iterate through tags and add appropriate indentation and linebreaks
	while read tag idepth prebreaks postbreaks; do
		( [ "$tag" = '#' ] || [ ! $postbreaks ] ) && continue  # Invalid; skip
		unset _indent _pre _post _sed_pre _sed_post _sed_oneshot

		printf "%15s | %6d | %8d | %9s\n" "$tag" $idepth $prebreaks $postbreaks

		# Special characters (\n) need double escaping when saved to a variable
		# since they are dereferenced and break everytime they're passed around.
		# bash printf has a %q format character for this, but we're /bin/sh

		# Should always be a prepended linebreak unless we opt out with -1
		_pre="$(repeat_char '\\n' $((prebreaks+1)))"
		_post="$(repeat_char '\\n' $postbreaks)"
		_indent="$(repeat_char "$INDENT_CHAR" $idepth)"

		# breaks before opening <tags> and <tags/>
		_sed_pre="s:<${tag}[ />]:${_pre}${_indent}\0:g;"
		# breaks after closing </tags>
		_sed_post="s:</${tag}>:\n${_indent}\0${_post}:g;"
		# breaks after oneshot <tags/>
		_sed_oneshot="s:<${tag}\(/>\| [^>]\+/>\):\0${_post}:g;"

		sed -ir "$_sed_pre $_sed_post $_sed_oneshot" $RULESETS
	done <<- EOF
		$TAG_DEFINITIONS
	EOF

	echo #padding for some distance after the tag table
}

rulesize() {
	wc -c < $RULESETS
}

populate_rulesets() {
	local xmlfile
	# Under git bash, sed -i issues errors and sets the file "read only"
	[ -f "$RULESETS" ] && chmod u+w $RULESETS

	printf '<rulesetlibrary gitcommitid="%s">' \
		"${GIT_COMMIT_ID:-unset}" > $RULESETS

	# Include the filename.xml as the "f" attribute
	for xmlfile in chrome/content/rules/*.xml; do
		sed "s/<ruleset/\0 f=\"${xmlfile##*/}\"/g" "$xmlfile" >> $RULESETS
	done

	echo "</rulesetlibrary>" >> $RULESETS
}

flatten_file() {
	# Strip *all* control chars; we'll re-add them soon as per tag definitions.
	# tr cannot edit in-place so we need to temp, either in a file or a variable
	echo "$(tr -d '[:cntrl:]' < $RULESETS | tr -s '[:space:]')" > $RULESETS
	# Beware that this *assumes* the used shell accepts variable sizes of >2Mb.
}


# Execution start

cd src

echo "Creating ruleset library..."
populate_rulesets

echo "Removing control characters, whitespace and comments..."
PRECRUSH=$(rulesize)
flatten_file

echo "Formatting..."
format_rulesets

echo "Final touches..."
# sed -i is not portable (GNU extension), but maybe we don't care.
sed -ir "$SED_TRIM_CMD" $RULESETS
POSTCRUSH=$(rulesize)

# All done, print summary
printf "Crushed %d bytes of rulesets into %d (delta %d)\n" \
	$PRECRUSH $POSTCRUSH $((POSTCRUSH-PRECRUSH))

# Timestamp
touch -r chrome/content/rules $RULESETS

# We need to keep $RULESETS for makecrx.sh but the rest is of no further use
unset INDENT_CHAR TAG_DEFINITIONS SED_TRIM_CMD PRECRUSH POSTCRUSH
unset repeat_char format_rulesets rulesize populate_rulesets flatten_file

cd ..


# grep tests to ensure the sed magic worked (should find no matches):
#
#   non-indenting double whitespace: '[^ ] \{2,\}'
#   missing space after field:       '="[^"]\+"[^ />]'  # not perfect
#   trailing whitespace:             ' $'               # pipe to | cat -A -
#   malformed http(s) protocol text  'http[s?]\{,2\}[^:]//'
#   random double+ slashes:          '[^:;]//'
#
