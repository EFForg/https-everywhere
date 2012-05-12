#!/bin/sh

# Merge all the .xml rulesets into a single "default.rulesets" file -- this
# prevents inodes from wasting disk space, but more importantly, works around
# the fact that zip does not perform well on a pile of small files.
cd src
RULESETS=chrome/content/rules/default.rulesets
echo "Creating ruleset library..."

# Under git bash, sed -i issues errors and sets the file "read only".  Thanks.
[ -f "$RULESETS" ] && chmod u+w $RULESETS

echo "<rulesetlibrary gitcommitid=\"${GIT_COMMIT_ID}\">" > $RULESETS
# Include the filename.xml as the "f" attribute
for file in chrome/content/rules/*.xml; do
	xmlInsertString="<ruleset" 
	fileName=$(basename "$file")
	fileContent=$(sed "s/${xmlInsertString}/${xmlInsertString} f=\"${fileName}\"/" "chrome/content/rules/${fileName}")
	echo "$fileContent" >> $RULESETS
done
echo "</rulesetlibrary>" >> $RULESETS

echo "Removing whitespaces and comments..."

rulesize() {
	echo `wc -c $RULESETS | cut -d \  -f 1`
}
CRUSH=`rulesize`
sed -i -e :a -re 's/<!--.*?-->//g;/<!--/N;//ba' $RULESETS
sed -i ':a;N;$!ba;s/\n//g;s/>[ 	]*</></g;s/[ 	]*to=/ to=/g;s/[ 	]*from=/ from=/g;s/ \/>/\/>/g' $RULESETS
echo "Crushed $CRUSH bytes of rulesets into `rulesize`"

if [ -x $(which xmllint)]
then
   if xmllint --noout $RULESETS
   then
      echo "$RULESETS passed XML validity test."
   else
      echo "ERROR: $RULESETS failed XML validity test."
      exit 2
   fi
else
   echo "WARNING: xmllint not present; validation of $RULESETS skipped."
fi

# We make default.rulesets at build time, but it shouldn't have a variable
# timestamp
touch -r chrome/content/rules $RULESETS

cd ..
