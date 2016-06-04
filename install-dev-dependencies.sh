#!/bin/bash -ex
# Install packages that are necessary and/or useful to build and debug
# HTTPS Everywhere
set -o errexit -o xtrace
if type apt-get >/dev/null ; then
  BROWSERS="firefox chromium-browser"
  CHROMEDRIVER="chromium-chromedriver"
  if [[ "$(lsb_release -is)" == "Debian" ]]; then
    # Iceweasel is the rebranded Firefox that Debian ships, and Chromium
    # takes the name of 'chromium' instead of 'chromium-browser' in
    # Debian 7 (wheezy) and later.
    BROWSERS="iceweasel chromium"
    CHROMEDRIVER="chromedriver"
  fi
  sudo apt-get install libxml2-dev libxml2-utils libxslt1-dev python-dev \
    $BROWSERS zip sqlite3 python-pip libcurl4-openssl-dev xvfb \
    libssl-dev git $CHROMEDRIVER
elif type brew >/dev/null ; then
  brew list python &>/dev/null || brew install python
  brew install libxml2 gnu-sed chromedriver
  if ! echo $PATH | grep -ql /usr/local/bin ; then
    echo '/usr/local/bin not found in $PATH, please add it.'
  fi
elif type dnf >/dev/null ; then
  sudo dnf install libxml2-devel python-devel libxslt-devel
fi

# Get the addon SDK submodule and rule checker
git submodule init
git submodule update

# Install Python packages
pip install --user --no-allow-insecure --no-allow-external -r requirements.txt
cd test/rules
pip install --user -r requirements.txt
cd -
cd test/chromium
pip install --user -r requirements.txt
cd -

# Install git hook to run tests before pushing.
ln -sf ../../test.sh .git/hooks/pre-push
