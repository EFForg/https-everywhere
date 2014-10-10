#!/bin/bash -ex
# Install packages that are necessary and/or useful to build and debug
# HTTPS Everywhere
set -o errexit -o xtrace
if type apt-get >/dev/null ; then
  sudo apt-get install libxml2-dev libxml2-utils libxslt1-dev python-dev \
    firefox chromium-browser zip sqlite3
elif type brew >/dev/null ; then
  brew install python libxml2 gnu-sed
  if ! echo $PATH | grep -ql /usr/local/bin ; then
    echo '/usr/local/bin not found in $PATH, please add it.'
  fi
fi
pip install --user -r requirements.txt
# Get the addon SDK submodule
git submodule init
git submodule update

# Install a hook to run tests before pushing.
ln -sf ../../test.sh .git/hooks/pre-push
