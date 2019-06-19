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
if type adb > /dev/null 2>/dev/null ; then
  #running `adb devices` below will start adb server/daemon if it wasn't running already
  #we start it and make note if it's us that started it or not, so we can stop it afterwards
  if adb start-server 2>&1 |grep -qF 'daemon not running' ; then
    we_started_adb_daemon=1
  else
    we_started_adb_daemon=0
  fi
  on_exit() {
    if test "0$we_started_adb_daemon" == "01"; then
      #if we started it we kill it, to avoid constant dmesg PME# spam, see issue 18103
      adb kill-server
    fi
  }
  trap on_exit EXIT SIGINT

  if adb devices >/dev/null 2>/dev/null ; then
    ADB_FOUND=`adb devices | grep -v 'offline$' | tail -2 | head -1 | cut -f 1 | sed 's/ *$//g'`
    if [ "$ADB_FOUND" != "List of devices attached" ]; then
      echo Pushing "$XPI_NAME" to /sdcard/"$XPI_NAME"
      adb push "../$XPI_NAME" /sdcard/"$XPI_NAME"
      adb shell am start -a android.intent.action.VIEW \
                         -c android.intent.category.DEFAULT \
                         -d file:///mnt/sdcard/pkg/ \
                         -n $ANDROID_APP_ID/.App
    fi
  fi
fi


