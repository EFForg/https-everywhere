#!/bin/bash
# Remove from ruleset whitelist the filenames of files that
# no longer exist or have no matching hash sums.

! getopt --test > /dev/null
if [[ ${PIPESTATUS[0]} -ne 4 ]]; then
  echo 'I’m sorry, `getopt --test` failed in this environment.'
  exit 1
fi

OPTIONS=u
LONGOPTS=update-hash-if-mismatched
! PARSED=$(getopt --options=$OPTIONS --longoptions=$LONGOPTS --name "$0" -- "$@")
if [[ ${PIPESTATUS[0]} -ne 0 ]]; then
  # e.g. return value is 1
  #  then getopt has complained about wrong arguments to stdout
  exit 2
fi

# read getopt’s output this way to handle the quoting right:
eval set -- "$PARSED"

UPDATE_HASH_IF_MISMATCHED=false
while true; do
  case "$1" in
    -u|--update-hash-if-mismatched)
      UPDATE_HASH_IF_MISMATCHED=true
      shift
      ;;
    --)
      shift
      break
      ;;
    *)
      echo "Programming error"
      exit 3
      ;;
  esac
done


# Change directory to git root; taken from ../test/test.sh
if [ -n "$GIT_DIR" ]
then
    # $GIT_DIR is set, so we're running as a hook.
    cd $GIT_DIR
else
    # Git command exists? Cool, let's CD to the right place.
    git rev-parse && cd "$(git rev-parse --show-toplevel)"
fi

# Run from ruleset folder to simplify sha256sum output
cd src/chrome/content/rules
WLIST=../../../../utils/ruleset-whitelist.csv
DELIM=","

(read; while IFS=$DELIM read listed_hash coverage_flag fetch_flag file; do
  display_hash=$(echo $listed_hash | cut -c-7)
  # Remove those that no longer exist
  if [ ! -f $file ]; then
    sed -i "/$listed_hash$DELIM$coverage_flag$DELIM$fetch_flag$DELIM$file/d" $WLIST
    echo >&2 "Removed $file ($display_hash): file no longer exists"
  elif [ "$coverage_flag" == "0" -a "$fetch_flag" == "0" ]; then
    sed -i "/$listed_hash$DELIM$coverage_flag$DELIM$fetch_flag$DELIM$file/d" $WLIST
    echo >&2 "Removed $file ($display_hash): obsolete, all flags set to false"
  else
    actual_hash=$(sha256sum $file | cut -c-64)
    new_display_hash=$(echo $actual_hash | cut -c-7)
    # Remove those whose hashes do not match
    if [ "$listed_hash" != "$actual_hash" ]; then
      if $UPDATE_HASH_IF_MISMATCHED; then
        sed -i "s/$listed_hash$DELIM$coverage_flag$DELIM$fetch_flag$DELIM$file/$actual_hash$DELIM$coverage_flag$DELIM$fetch_flag$DELIM$file/" $WLIST
        echo >&2 "Updated $file ($display_hash...$new_display_hash): listed hash is updated"
      else
        sed -i "/$listed_hash$DELIM$coverage_flag$DELIM$fetch_flag$DELIM$file/d" $WLIST
        echo >&2 "Removed $file ($display_hash): listed hash does not match actual hash"
      fi
    fi
  fi
done) < "$WLIST"

# Sorting by the 4th column (ruleset name)
TMPFILE=`mktemp`
(head -n1 "$WLIST" && tail -n +2 "$WLIST" | sort -t"," -b -u -k4) > "$TMPFILE"
mv "$TMPFILE" "$WLIST"
