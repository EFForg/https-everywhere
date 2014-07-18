#! /usr/bin/env bash

version=`python --version`

if [[ $version < "Python 3" ]]
then
  python -m SimpleHTTPServer $1;
else
  python -m http.server --cgi $1;
fi
