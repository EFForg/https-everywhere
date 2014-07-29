#! /usr/bin/env bash

version=`python --version`

if [[ $version < "Python 3" ]]; then
  python -m SimpleHTTPServer
else
  python -m http.server
fi
