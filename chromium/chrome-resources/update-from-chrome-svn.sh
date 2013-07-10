#!/bin/sh

HOST='https://src.chromium.org'
BASE='chrome/trunk/src/ui/webui/resources'
FILES='
css/chrome_shared.css
css/widgets.css
images/check.png'

for FILE in $FILES; do
	wget --force-directories --no-host-directories --cut-dirs=6 $HOST/$BASE/$FILE
done

