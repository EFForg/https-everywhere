#!/bin/sh
APP_NAME=https-everywhere
VERSION=`grep em:version src/install.rdf | sed -e 's/[<>]/	/g' | cut -f3`
XPI_NAME=$APP_NAME-$VERSION.xpi

if [ -e "pkg/$XPI_NAME" ]; then
  echo pkg/$XPI_NAME already exists.
  rm pkg/$XPI_NAME # meh.
  #  exit 1
fi

# create jar file (we're just storing files here)
echo ---------- create $APP_NAME.jar file ----------
cd src/chrome
#zip -r0 ../../$APP_NAME.jar ./ -x "*.svn/*"
cd ../..

# create .xpi
echo ---------- create $APP_NAME.xpi ----------
cd src
echo zip -X -9r ../pkg/$XPI_NAME ./ -x "certDialogsOverride.js" -x "chrome/*" -x "*.diff" -x "*.svn/*" -x ".*.sw?"
zip -X -9r ../pkg/$XPI_NAME ./ -x "*.svn/*" -x "*.diff" -x "*.swp" #-x "chrome/*"
#mv ../$APP_NAME.jar ./chrome
#zip -9m ../pkg/$XPI_NAME chrome/$APP_NAME.jar
cd ..

#cp ./pkg/$XPI_NAME ~/
#zip -9m ../../downloads/$sXpiName  chrome/$APP_NAME.jar
#zip -9  ../../downloads/$sXpiName  install.rdf
#cd ..
