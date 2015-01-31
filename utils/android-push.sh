#!/bin/bash
set -o errexit

cd $(dirname $0)
XPI_NAME=$1
ANDROID_APP_ID=org.mozilla.firefox
if [ -z "$XPI_NAME" ] ; then
  echo "No package name given to android-push.sh."
  exit 1
fi

# Push to Android Firefox if device is connected
# XXX on some systems, adb may require sudo...
if type adb > /dev/null 2>/dev/null && adb devices >/dev/null 2>/dev/null ; then
  ADB_FOUND=`adb devices | tail -2 | head -1 | cut -f 1 | sed 's/ *$//g'`
  if [ "$ADB_FOUND" != "List of devices attached" ]; then
    echo Pushing "$XPI_NAME" to /sdcard/"$XPI_NAME"
    adb push "../$XPI_NAME" /sdcard/"$XPI_NAME"
    adb shell am start -a android.intent.action.VIEW \
                       -c android.intent.category.DEFAULT \
                       -d file:///mnt/sdcard/"$XPI_NAME" \
                       -n $ANDROID_APP_ID/.App
  fi
fi


